from sqlalchemy import Column, Integer, Text, DateTime, String, ForeignKey
from sqlalchemy.sql import func

from .database import Base


class Conversation(Base):

    __tablename__ = "conversations"

    id = Column(
        String,
        primary_key=True,
        index=True
    )

    title = Column(
        String,
        default="New chat"
    )

    summary = Column(
        Text,
        default=""
    )

    last_summarized_message_id = Column(
        Integer,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )


class ChatMessage(Base):

    __tablename__ = "chat_messages"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    conversation_id = Column(
        String,
        ForeignKey("conversations.id"),
        nullable=False,
        index=True
    )

    role = Column(
        String,
        nullable=False
    )

    content = Column(
        Text,
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )