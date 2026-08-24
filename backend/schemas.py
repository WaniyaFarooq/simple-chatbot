from pydantic import BaseModel


class CreateConversation(BaseModel):
    title: str = "New chat"


class ChatRequest(BaseModel):
    conversation_id: str
    usermsg: str