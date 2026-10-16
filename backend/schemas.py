from pydantic import BaseModel, Field


class CreateConversation(BaseModel):
    title: str = Field(default="New chat", max_length=120)


class ChatRequest(BaseModel):
    conversation_id: str
    usermsg: str = Field(min_length=1, max_length=8000)