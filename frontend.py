import streamlit as st
import requests

st.title("🤖 My Chatbot")

user_message = st.text_input("Enter your message")

if st.button("Send"):
    response = requests.post(
        "http://127.0.0.1:8000/human_prompt",
        json={
            "usermsg": user_message
        }
    )

    st.write(response.text)