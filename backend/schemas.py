from pydantic import BaseModel


class Message(BaseModel):
    usermsg: str