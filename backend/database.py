from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv


# --------------------------------------------------
# 1. .env file se environment variables load karo
# --------------------------------------------------

load_dotenv()


# --------------------------------------------------
# 2. .env se DATABASE_URL nikalo
#
# Example .env:
#
# DATABASE_URL=postgresql://postgres:password@localhost/chatbot
#
# os.getenv("DATABASE_URL") us value ko read karega.
# --------------------------------------------------

DATABASE_URL = os.getenv("DATABASE_URL")


# --------------------------------------------------
# 3. Database Engine banao
#
# Engine SQLAlchemy aur PostgreSQL ke darmiyan
# connection/manage karne ka main object hai.
# --------------------------------------------------

engine = create_engine(
    DATABASE_URL,

    # Database connection use karne se pehle
    # check karega ke connection still alive hai ya nahi.
    pool_pre_ping=True,
)


# --------------------------------------------------
# 4. Database sessions banane ki factory banao
#
# SessionLocal khud session nahi hai.
# Ye sessions BANANE ka template/factory hai.
# --------------------------------------------------

SessionLocal = sessionmaker(

    # Changes automatically commit nahi honge.
    # Jab zaroorat ho hum manually db.commit() karenge.
    autocommit=False,

    # SQLAlchemy automatically pending changes ko
    # flush nahi karega.
    autoflush=False,

    # Jo sessions banenge wo isi engine/database
    # ke saath connected honge.
    bind=engine
)


# --------------------------------------------------
# 5. SQLAlchemy ke models ke liye BASE class banao
#
# Ye VERY IMPORTANT hai.
#
# Hum baad mein apne models ko is Base se inherit
# karwayenge:
#
# class Conversation(Base):
#     ...
#
# Is inheritance se SQLAlchemy samajhta hai ke
# Conversation ek database model hai.
# --------------------------------------------------

Base = declarative_base()


# --------------------------------------------------
# 6. Database session provide karne wala function
# --------------------------------------------------

def get_db():

    # SessionLocal() call karke actual database
    # session create kar rahe hain.
    db = SessionLocal()

    try:

        # Ye database session FastAPI ke endpoint ko
        # temporarily provide karta hai.
        #
        # Endpoint is "db" ke through database ke saath
        # kaam karega.
        yield db

    finally:

        # Kaam complete hone ke baad database session
        # close kar do.
        #
        # Ye resources ko properly release karta hai.
        db.close()