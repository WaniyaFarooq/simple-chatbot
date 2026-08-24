import os
import uuid
from datetime import datetime
from fastapi import (
    FastAPI,
    Depends,
    BackgroundTasks,
    HTTPException
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from sqlalchemy.orm import Session

from dotenv import load_dotenv

from langchain_groq import ChatGroq

from langchain_core.messages import (
    HumanMessage,
    AIMessage,
    SystemMessage
)

from .database import (
    get_db,
    SessionLocal,
    Base,
    engine
)

from . import models

from .schemas import (
    CreateConversation,
    ChatRequest
)


load_dotenv()


app = FastAPI()


# ============================================
# CORS
# ============================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ============================================
# CREATE TABLES
# ============================================

Base.metadata.create_all(
    bind=engine
)


# ============================================
# LLM
# ============================================

def get_llm():

    return ChatGroq(
        model="openai/gpt-oss-20b",
        groq_api_key=os.getenv(
            "GROQ_API_KEY"
        ),
        temperature=0
    )


# ============================================
# CREATE CONVERSATION
# ============================================

@app.post("/conversations")
def create_conversation(
    data: CreateConversation,
    db: Session = Depends(get_db)
):

    conversation_id = str(
        uuid.uuid4()
    )

    conversation = models.Conversation(
        id=conversation_id,
        title=data.title,
        summary=""
    )

    db.add(conversation)

    db.commit()

    return {
        "id": conversation_id,
        "title": conversation.title
    }


# ============================================
# GET ALL CONVERSATIONS
# ============================================

@app.get("/conversations")
def get_conversations(
    db: Session = Depends(get_db)
):

    conversations = (
        db.query(models.Conversation)
        .order_by(
            models.Conversation.updated_at.desc()
        )
        .all()
    )

    return [
        {
            "id": conversation.id,
            "title": conversation.title
        }

        for conversation in conversations
    ]


# ============================================
# GET FULL CHAT
# ============================================

@app.get(
    "/conversations/{conversation_id}/messages"
)
def get_messages(
    conversation_id: str,
    db: Session = Depends(get_db)
):

    messages = (
        db.query(models.ChatMessage)
        .filter(
            models.ChatMessage.conversation_id
            == conversation_id
        )
        .order_by(
            models.ChatMessage.id
        )
        .all()
    )

    return [
        {
            "role": message.role,
            "content": message.content
        }

        for message in messages
    ]


# ============================================
# DELETE CONVERSATION
# ============================================

@app.delete(
    "/conversations/{conversation_id}"
)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db)
):

    conversation = (
        db.query(models.Conversation)
        .filter(
            models.Conversation.id
            == conversation_id
        )
        .first()
    )

    if not conversation:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )


    db.query(models.ChatMessage).filter(
        models.ChatMessage.conversation_id
        == conversation_id
    ).delete(
        synchronize_session=False
    )


    db.delete(conversation)

    db.commit()


    return {
        "message": "Conversation deleted"
    }


# ============================================
# BUILD LLM CONTEXT
# ============================================

def build_context(
    conversation,
    db
):

    # Ordered by id (not created_at) since same-second
    # inserts can otherwise shuffle message order.
    recent_messages = (
        db.query(models.ChatMessage)
        .filter(
            models.ChatMessage.conversation_id
            == conversation.id
        )
        .order_by(
            models.ChatMessage.id.desc()
        )
        .limit(10)
        .all()
    )


    recent_messages.reverse()


    context = []


    # ----------------------------------------
    # SUMMARY
    # ----------------------------------------

    if conversation.summary:

        context.append(
            SystemMessage(
                content=(
                    "Here is the long-term memory "
                    "of this conversation:\n\n"
                    + conversation.summary
                )
            )
        )


    # ----------------------------------------
    # RECENT MESSAGES
    # ----------------------------------------

    for message in recent_messages:

        if message.role == "user":

            context.append(
                HumanMessage(
                    content=message.content
                )
            )

        elif message.role == "assistant":

            context.append(
                AIMessage(
                    content=message.content
                )
            )


    return context


# ============================================
# UPDATE SUMMARY
# ============================================

def update_summary(
    conversation_id: str
):

    db = SessionLocal()

    try:

        conversation = (
            db.query(models.Conversation)
            .filter(
                models.Conversation.id
                == conversation_id
            )
            .first()
        )


        if not conversation:
            return


        # ------------------------------------
        # Get all messages
        # ------------------------------------

        messages = (
            db.query(models.ChatMessage)
            .filter(
                models.ChatMessage.conversation_id
                == conversation_id
            )
            .order_by(
                models.ChatMessage.id
            )
            .all()
        )


        # ------------------------------------
        # Only summarize when enough messages
        # ------------------------------------

        if len(messages) < 20:

            return


        # Keep latest 10 messages untouched.
        # Everything before them can be summarized.

        messages_to_summarize = messages[:-10]


        if not messages_to_summarize:

            return


        # ------------------------------------
        # Avoid summarizing same messages again
        # ------------------------------------

        if conversation.last_summarized_message_id:

            messages_to_summarize = [
                message

                for message in messages_to_summarize

                if message.id
                > conversation.last_summarized_message_id
            ]


        if not messages_to_summarize:

            return


        # ------------------------------------
        # Prepare transcript
        # ------------------------------------

        transcript = ""

        for message in messages_to_summarize:

            transcript += (
                f"{message.role.upper()}: "
                f"{message.content}\n"
            )


        old_summary = (
            conversation.summary
            or "No previous memory."
        )


        # ------------------------------------
        # Summary prompt
        # ------------------------------------

        prompt = f"""
You maintain long-term memory for a chatbot.

Existing memory:

{old_summary}


New conversation information:

{transcript}


Update the memory.

Keep ONLY information that may matter in future
conversation turns.

Preserve:

- User preferences
- User identity information that is useful
- User goals
- Important project details
- Technical requirements
- Decisions already made
- Important constraints
- Important unresolved issues
- Facts the user explicitly wants remembered

Do NOT preserve:

- Greetings
- Small talk
- Repetitive explanations
- Temporary conversational filler
- Questions that have no future relevance

Write a concise factual memory.

Do not invent information.
"""


        llm = get_llm()


        response = llm.invoke(
            [
                SystemMessage(
                    content=prompt
                )
            ]
        )


        conversation.summary = (
            response.content
        )


        conversation.last_summarized_message_id = (
            messages_to_summarize[-1].id
        )


        db.commit()


    finally:

        db.close()


# ============================================
# STREAM CHAT
# ============================================

@app.post("/chat")
def chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):

    # ----------------------------------------
    # Find conversation
    # ----------------------------------------

    conversation = (
        db.query(models.Conversation)
        .filter(
            models.Conversation.id
            == request.conversation_id
        )
        .first()
    )


    if not conversation:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )


    # ----------------------------------------
    # Build context BEFORE current message
    # ----------------------------------------

    context = build_context(
        conversation,
        db
    )


    # Is this the first message of the conversation?
    # Used to decide whether to kick off title
    # generation once the response finishes.

    is_first_message = (
        db.query(models.ChatMessage)
        .filter(
            models.ChatMessage.conversation_id
            == request.conversation_id
        )
        .count()
        == 0
    )


    # Add current message

    context.append(
        HumanMessage(
            content=request.usermsg
        )
    )


    llm = get_llm()


    def generate():

        full_response = ""

        try:

            # --------------------------------
            # STREAM FROM GROQ
            # --------------------------------

            for chunk in llm.stream(context):

                text = chunk.content

                if not text:
                    continue

                full_response += text

                yield text


            # --------------------------------
            # SAVE AFTER GENERATION (success path)
            # --------------------------------

            _persist_turn(
                request.conversation_id,
                request.usermsg,
                full_response
            )


            # --------------------------------
            # UPDATE MEMORY
            # --------------------------------

            background_tasks.add_task(
                update_summary,
                request.conversation_id
            )


            # --------------------------------
            # GENERATE A DECENT TITLE
            # (first message only — later messages
            # keep whatever title was already set)
            # --------------------------------

            if is_first_message and full_response:

                background_tasks.add_task(
                    generate_title,
                    request.conversation_id,
                    request.usermsg,
                    full_response
                )


        except Exception as e:

            print(
                "Streaming error:",
                e
            )

            # Persist whatever we managed to generate
            # before the failure, so nothing is silently
            # lost and the turn can still show up in history.

            _persist_turn(
                request.conversation_id,
                request.usermsg,
                full_response,
                errored=True
            )

            yield "\n\n[Error generating response]"


    # NOTE: this belongs to chat(), not generate() —
    # generate() is a generator (it has `yield`), so a
    # `return` inside it would just end iteration rather
    # than hand a value back to FastAPI.
    return StreamingResponse(
        generate(),
        media_type="text/plain"
    )


# ============================================
# PERSIST ONE USER/ASSISTANT TURN
# ============================================

# ============================================
# GENERATE A DECENT TITLE (background)
# ============================================

def generate_title(
    conversation_id: str,
    user_text: str,
    assistant_text: str
):

    db = SessionLocal()

    try:

        conversation = (
            db.query(models.Conversation)
            .filter(
                models.Conversation.id
                == conversation_id
            )
            .first()
        )

        if not conversation:
            return


        prompt = f"""
Generate a short, descriptive title for this
conversation based on the exchange below.

Rules:

- 3 to 6 words
- No quotation marks
- No trailing punctuation
- No prefixes like "Title:" or "Chat about"
- Capture the main topic or task, not small talk
- Plain text only, nothing else in the response


USER: {user_text}

ASSISTANT: {assistant_text[:1000]}
"""


        llm = get_llm()


        response = llm.invoke(
            [
                SystemMessage(
                    content=prompt
                )
            ]
        )


        title = (
            response.content
            or ""
        ).strip()


        # Strip surrounding quotes if the model added them
        # anyway, and collapse whitespace.

        title = title.strip('"').strip("'")

        title = " ".join(title.split())


        if title:

            # Guard against a runaway/malformed response

            if len(title) > 60:
                title = title[:60].rstrip()

            conversation.title = title

            db.commit()


    except Exception as e:

        print(
            "Title generation error:",
            e
        )


    finally:

        db.close()


def _make_title(text: str) -> str:

    # Simple, cheap title derivation from the first
    # user message — no extra LLM call needed. Trims
    # to a sane length and cleans up whitespace.

    cleaned = " ".join(text.strip().split())

    if not cleaned:
        return "New chat"

    max_len = 40

    if len(cleaned) <= max_len:
        return cleaned

    return cleaned[:max_len].rstrip() + "..."


def _persist_turn(
    conversation_id: str,
    user_text: str,
    assistant_text: str,
    errored: bool = False
):

    # Nothing at all to save (e.g. failed before any
    # tokens came back) — skip.
    if not user_text and not assistant_text:
        return

    save_db = SessionLocal()

    try:

        # ------------------------------------
        # Set title from the FIRST message only
        # ------------------------------------

        existing_message_count = (
            save_db.query(models.ChatMessage)
            .filter(
                models.ChatMessage.conversation_id
                == conversation_id
            )
            .count()
        )

        if existing_message_count == 0:

            conversation_for_title = (
                save_db.query(models.Conversation)
                .filter(
                    models.Conversation.id
                    == conversation_id
                )
                .first()
            )

            if (
                conversation_for_title
                and user_text
            ):

                conversation_for_title.title = (
                    _make_title(user_text)
                )


        save_db.add(
            models.ChatMessage(
                conversation_id=conversation_id,
                role="user",
                content=user_text
            )
        )

        if assistant_text:

            save_db.add(
                models.ChatMessage(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=assistant_text
                    + (
                        "\n\n[response truncated due to an error]"
                        if errored else ""
                    )
                )
            )

        conversation_db = (
            save_db.query(models.Conversation)
            .filter(
                models.Conversation.id
                == conversation_id
            )
            .first()
        )

        if conversation_db:
            conversation_db.updated_at = datetime.utcnow()

        save_db.commit()

    finally:

        save_db.close()