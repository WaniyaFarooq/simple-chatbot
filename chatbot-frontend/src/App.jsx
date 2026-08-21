import { useState } from "react";
import "./App.css";

function App() {
  const [userMessage, setUserMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!userMessage.trim() || loading) return;

    const currentMessage = userMessage;

    // Show user's message immediately
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: currentMessage,
      },
    ]);

    setUserMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/human_prompt",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            usermsg: currentMessage,
          }),
        }
      );

      const data = await response.json();

      // Add AI response
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
        },
      ]);
    } catch (error) {
      console.error("Error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong.",
        },
      ]);
    }

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const newChat = () => {
    setMessages([]);
    setUserMessage("");
  };

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <button className="new-chat" onClick={newChat}>
          + New chat
        </button>

        <div className="sidebar-title">
          My Chatbot
        </div>

        <div className="sidebar-bottom">
          <span>🤖</span>
          <span>AI Chatbot</span>
        </div>
      </aside>

      {/* MAIN CHAT */}
      <main className="chat-container">

        {/* HEADER */}
        <header className="chat-header">
          <div className="bot-name">
            🤖 My Chatbot
          </div>

          <div className="header-right">
            <span>Groq</span>
          </div>
        </header>

        {/* MESSAGES */}
        <div className="messages">

          {messages.length === 0 && (
            <div className="welcome">
              <div className="welcome-icon">🤖</div>

              <h1>How can I help you?</h1>

              <p>
                Ask me anything. I'm your AI assistant.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`message-row ${message.role}`}
            >
              <div className="avatar">
                {message.role === "user" ? "U" : "🤖"}
              </div>

              <div className="message-content">
                {message.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row assistant">
              <div className="avatar">🤖</div>

              <div className="message-content typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

        </div>

        {/* INPUT AREA */}
        <div className="input-area">

          <div className="input-box">

            <textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message My Chatbot..."
              rows="1"
            />

            <button
              className="send-button"
              onClick={sendMessage}
              disabled={!userMessage.trim() || loading}
            >
              ↑
            </button>

          </div>

          <p className="disclaimer">
            AI can make mistakes. Check important information.
          </p>

        </div>

      </main>
    </div>
  );
}

export default App;