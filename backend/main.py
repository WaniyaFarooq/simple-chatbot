import os
from fastapi import Depends
from sqlalchemy.orm import Session

from .database import get_db
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from pydantic import BaseModel

from  .schemas import Message
# class message(BaseModel):
#     usermsg: str


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173" ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .database import Base, engine
from . import models

Base.metadata.create_all(bind=engine)
@app.post("/human_prompt")
def human_prompt( message: Message,
    db: Session = Depends(get_db)):

    load_dotenv()

    llm = ChatGroq(
       model="openai/gpt-oss-20b",
        groq_api_key=os.getenv("GROQ_API_KEY")
    )

    response = llm.invoke(message.usermsg)
    chat = models.ChatMessage(
    user_message=message.usermsg,
    ai_response=response.content
)
    db.add(chat)
    db.commit()
    
    db.refresh(chat)
    return {
        "response": response.content
    }