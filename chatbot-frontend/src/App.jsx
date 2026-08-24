import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";


const API = "http://127.0.0.1:8000";


function App() {

  const [conversations, setConversations] =
    useState([]);

  const [conversationId, setConversationId] =
    useState(null);

  const [messages, setMessages] =
    useState([]);

  const [userMessage, setUserMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const messagesEndRef = useRef(null);


  // ========================================
  // LOAD CONVERSATIONS
  // ========================================

  useEffect(() => {

    loadConversations();

  }, []);


  // ========================================
  // LOAD CHAT WHEN CONVERSATION CHANGES
  // ========================================

  useEffect(() => {

    if (!conversationId) {
      return;
    }

    loadMessages(
      conversationId
    );

  }, [conversationId]);


  // ========================================
  // AUTO-SCROLL TO LATEST MESSAGE
  // ========================================

  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });

  }, [messages]);


  // ========================================
  // GET CONVERSATIONS
  // ========================================

  const loadConversations = async () => {

    try {

      const response = await fetch(
        `${API}/conversations`
      );

      const data =
        await response.json();

      setConversations(data);


      const savedId =
        localStorage.getItem(
          "conversation_id"
        );


      if (
        savedId &&
        data.some(
          (chat) =>
            chat.id === savedId
        )
      ) {

        setConversationId(
          savedId
        );

      }

      else if (data.length > 0) {

        setConversationId(
          data[0].id
        );

        localStorage.setItem(
          "conversation_id",
          data[0].id
        );

      }

      else {

        createNewChat();

      }

    } catch (error) {

      console.error(
        "Failed to load conversations:",
        error
      );

    }
  };


  // ========================================
  // CREATE NEW CHAT
  // ========================================

  const createNewChat = async () => {

    try {

      const response = await fetch(
        `${API}/conversations`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            title: "New chat",
          }),
        }
      );


      const data =
        await response.json();


      setConversations(
        (prev) => [
          data,
          ...prev
        ]
      );


      setConversationId(
        data.id
      );


      localStorage.setItem(
        "conversation_id",
        data.id
      );


      setMessages([]);

    } catch (error) {

      console.error(
        "Failed to create chat:",
        error
      );

    }
  };


  // ========================================
  // LOAD FULL CHAT
  // ========================================

  const loadMessages = async (id) => {

    try {

      const response = await fetch(
        `${API}/conversations/${id}/messages`
      );


      const data =
        await response.json();


      setMessages(data);

    } catch (error) {

      console.error(
        "Failed to load messages:",
        error
      );

    }
  };


  // ========================================
  // SELECT CHAT
  // ========================================

  const selectConversation = (id) => {

    setConversationId(id);

    localStorage.setItem(
      "conversation_id",
      id
    );

  };


  // ========================================
  // SEND MESSAGE
  // ========================================

  const sendMessage = async () => {

    if (
      !userMessage.trim() ||
      loading ||
      !conversationId
    ) {

      return;

    }


    const currentMessage =
      userMessage;


    // Show user message immediately

    setMessages(
      (prev) => [
        ...prev,

        {
          role: "user",
          content: currentMessage,
        },

      ]
    );


    setUserMessage("");

    setLoading(true);


    // Add empty AI message
    // which we will fill while streaming
    // (rendered as the typing indicator until
    // the first token arrives — see the render
    // logic below, which skips this placeholder
    // to avoid showing two assistant rows at once)

    setMessages(
      (prev) => [
        ...prev,

        {
          role: "assistant",
          content: "",
        },

      ]
    );


    try {

      const response = await fetch(
        `${API}/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            conversation_id:
              conversationId,

            usermsg:
              currentMessage,
          }),
        }
      );


      if (!response.ok) {

        throw new Error(
          "Backend error"
        );

      }


      if (!response.body) {

        throw new Error(
          "Streaming not supported"
        );

      }


      const reader =
        response.body.getReader();


      const decoder =
        new TextDecoder();


      let aiText = "";


      while (true) {

        const {
          value,
          done
        } = await reader.read();


        if (done) {
          break;
        }


        const chunk =
          decoder.decode(
            value,
            {
              stream: true
            }
          );


        aiText += chunk;


        // Update last message

        setMessages(
          (prev) => {

            const updated =
              [...prev];


            updated[
              updated.length - 1
            ] = {

              role: "assistant",

              content: aiText,

            };


            return updated;

          }
        );

      }


      // Reload sidebar

      await loadConversations();


    } catch (error) {

      console.error(
        "Chat error:",
        error
      );


      setMessages(
        (prev) => {

          const updated =
            [...prev];


          updated[
            updated.length - 1
          ] = {

            role: "assistant",

            content:
              "Sorry, something went wrong.",

          };


          return updated;

        }
      );

    } finally {

      // Moved into `finally` so loading can never
      // get stuck true if something above throws
      // or returns early in the future.

      setLoading(false);

    }

  };


  // ========================================
  // DELETE CHAT
  // ========================================

  const deleteChat = async (
    id,
    event
  ) => {

    event.stopPropagation();


    try {

      await fetch(
        `${API}/conversations/${id}`,
        {
          method: "DELETE",
        }
      );


      const remaining =
        conversations.filter(
          (chat) =>
            chat.id !== id
        );


      setConversations(
        remaining
      );


      if (
        conversationId === id
      ) {

        if (
          remaining.length > 0
        ) {

          selectConversation(
            remaining[0].id
          );

        }

        else {

          createNewChat();

        }

      }

    } catch (error) {

      console.error(
        "Delete error:",
        error
      );

    }
  };


  // ========================================
  // ENTER KEY
  // ========================================

  const handleKeyDown = (e) => {

    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {

      e.preventDefault();

      sendMessage();

    }

  };


  // ========================================
  // UI
  // ========================================

  return (

    <div className="app">

      {/* ================================ */}
      {/* SIDEBAR */}
      {/* ================================ */}

      <aside className="sidebar">

        <button
          className="new-chat"
          onClick={createNewChat}
        >
          + New chat
        </button>


        <div className="sidebar-title">
          My Chatbot
        </div>


        <div className="conversation-list">

          {conversations.map(
            (chat) => (

              <div
                key={chat.id}

                className={
                  `conversation-item ${
                    chat.id === conversationId
                      ? "active"
                      : ""
                  }`
                }

                onClick={() =>
                  selectConversation(
                    chat.id
                  )
                }
              >

                <span>
                  💬 {chat.title}
                </span>


                <button
                  className="delete-chat"
                  onClick={(e) =>
                    deleteChat(
                      chat.id,
                      e
                    )
                  }
                >
                  ×
                </button>

              </div>

            )
          )}

        </div>


        <div className="sidebar-bottom">

          <span>🤖</span>

          <span>
            AI Chatbot
          </span>

        </div>

      </aside>


      {/* ================================ */}
      {/* MAIN CHAT */}
      {/* ================================ */}

      <main className="chat-container">


        {/* HEADER */}

        <header className="chat-header">

          <div className="bot-name">
            🤖 My Chatbot
          </div>


          <div className="header-right">
            <span>
              Groq
            </span>
          </div>

        </header>


        {/* MESSAGES */}

        <div className="messages">

          {messages.length === 0 && (

            <div className="welcome">

              <div className="welcome-icon">
                🤖
              </div>

              <h1>
                How can I help you?
              </h1>

              <p>
                Ask me anything.
                I'm your AI assistant.
              </p>

            </div>

          )}


          {messages.map(
            (message, index) => {

              // Skip rendering the empty assistant
              // placeholder while streaming hasn't
              // produced any tokens yet — the typing
              // indicator below covers that state.
              // Without this, you'd briefly see two
              // assistant rows stacked on top of
              // each other.

              const isEmptyPendingAssistant =
                message.role === "assistant" &&
                message.content === "" &&
                loading;

              if (isEmptyPendingAssistant) {
                return null;
              }

              return (

                <div
                  key={index}
                  className={
                    `message-row ${message.role}`
                  }
                >

                  <div className="avatar">

                    {message.role === "user"
                      ? "U"
                      : "🤖"}

                  </div>


                  <div className="message-content">

                    {message.role === "assistant" ? (

                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                      >
                        {message.content}
                      </ReactMarkdown>

                    ) : (

                      message.content

                    )}

                  </div>

                </div>

              );

            }
          )}


          {loading &&
            messages[
              messages.length - 1
            ]?.content === "" && (

              <div className="message-row assistant">

                <div className="avatar">
                  🤖
                </div>

                <div className="message-content typing">

                  <span></span>
                  <span></span>
                  <span></span>

                </div>

              </div>

            )}


          <div ref={messagesEndRef} />

        </div>


        {/* INPUT */}

        <div className="input-area">

          <div className="input-box">

            <textarea

              value={userMessage}

              onChange={(e) =>
                setUserMessage(
                  e.target.value
                )
              }

              onKeyDown={
                handleKeyDown
              }

              placeholder="Message My Chatbot..."

              rows="1"

            />


            <button

              className="send-button"

              onClick={
                sendMessage
              }

              disabled={
                !userMessage.trim() ||
                loading
              }

            >
              ↑
            </button>

          </div>


          <p className="disclaimer">

            AI can make mistakes.
            Check important information.

          </p>

        </div>

      </main>

    </div>
  );
}


export default App;