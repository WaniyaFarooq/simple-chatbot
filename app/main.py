import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

from fastapi import FastAPI
from pydantic import BaseModel
class message(BaseModel):
    usermsg:str
app = FastAPI()
@app.get('/')
def home():
    return {"message":"hello world"}

@app.post('/human_prompt')
def human_prompt(message:message):
    load_dotenv()
    llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY")
    )
    response = llm.invoke(message.usermsg)
    return  response.content