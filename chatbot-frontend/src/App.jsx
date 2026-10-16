import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const APP_NAME = "My Chatbot";
const STORAGE_KEY = "conversation_id";
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const MAX_UPLOAD_MB = 20;

const SUGGESTIONS = [
  "Explain a concept simply",
  "Help me draft an email",
  "Review my code",
  "Summarise a document",
];

// ============================================
// HELPERS
// ============================================

async function request(path, options) {
  const response = await fetch(`${API}${path}`, options);

  if (!response.ok) {
    let detail;
    try {
      detail = (await response.json()).detail;
    } catch {
      /* not JSON */
    }
    throw new Error(detail || `Request failed (${response.status})`);
  }

  return response;
}

function parseDate(value) {
  if (!value) return new Date(0);
  const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

function groupConversations(list) {
  const day = 86400000;
  const startOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(new Date());

  const groups = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  list.forEach((chat) => {
    const diff = today - startOfDay(parseDate(chat.updated_at));
    if (diff <= 0) groups.Today.push(chat);
    else if (diff <= day) groups.Yesterday.push(chat);
    else if (diff <= 7 * day) groups["Previous 7 days"].push(chat);
    else groups.Older.push(chat);
  });

  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function replaceLast(list, next) {
  const copy = [...list];
  copy[copy.length - 1] = next;
  return copy;
}

// ============================================
// ICONS
// ============================================

const ICONS = {
  plus: "M12 5v14M5 12h14",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  paperclip:
    "M21 11.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l8.6-8.6a3.7 3.7 0 015.2 5.2l-8.6 8.6a1.9 1.9 0 01-2.6-2.6l7.9-7.9",
  x: "M18 6L6 18M6 6l12 12",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3",
  file: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5",
  copy: "M9 9h10v10H9zM5 15V5h10",
  check: "M5 12.5l4.5 4.5L19 7",
  panel: "M3 5h18v14H3zM9 5v14",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
};

function Icon({ name, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

// ============================================
// MARKDOWN
// ============================================

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);

  const codeEl = children;
  const raw = codeEl?.props?.children;
  const text = Array.isArray(raw) ? raw.join("") : String(raw ?? "");
  const language = /language-(\w+)/.exec(codeEl?.props?.className || "")?.[1];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.replace(/\n$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="code-block">
      <div className="code-head">
        <span>{language || "text"}</span>
        <button onClick={copy} className="code-copy">
          <Icon name={copied ? "check" : "copy"} size={13} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

const markdownComponents = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
};

// ============================================
// MESSAGE
// ============================================

function Message({ message, streaming }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const waiting = streaming && !message.content;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (isUser) {
    return (
      <div className="msg user">
        <div className="user-bubble">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="msg assistant">
      <div className="msg-mark" aria-hidden="true" />

      <div className="msg-body">
        {waiting ? (
          <div className="typing" aria-label="Thinking">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className={`prose ${streaming ? "is-streaming" : ""}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {message.sources?.length > 0 && !waiting && (
          <div className="sources">
            <span className="sources-label">Sources</span>
            {message.sources.map((source) => (
              <span
                key={source.index}
                className="source"
                title={source.snippet}
              >
                <b>{source.index}</b>
                {source.source}
                {source.page ? ` · p. ${source.page}` : ""}
              </span>
            ))}
          </div>
        )}

        {!streaming && message.content && (
          <div className="msg-actions">
            <button onClick={copy} className="ghost-btn">
              <Icon name={copied ? "check" : "copy"} size={14} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// APP
// ============================================

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 860);
  const [dragging, setDragging] = useState(false);
  const [toasts, setToasts] = useState([]);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);
  const activeRef = useRef(null);
  const dragDepth = useRef(0);
  const initialized = useRef(false);

  // ---------- toasts ----------

  const toast = (message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4500
    );
  };

  // ---------- data loading ----------

  const refreshSidebar = async () => {
    try {
      const list = await (await request("/conversations")).json();
      setConversations(list);
    } catch (error) {
      console.error(error);
    }
  };

  const activate = (id) => {
    activeRef.current = id;
    setConversationId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const createChat = async ({ force = false } = {}) => {
    const isBlank = messages.length === 0 && documents.length === 0;

    if (!force && conversationId && isBlank) {
      textareaRef.current?.focus();
      return;
    }

    abortRef.current?.abort();

    try {
      const chat = await (
        await request("/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New chat" }),
        })
      ).json();

      setConversations((prev) => [chat, ...prev]);
      setMessages([]);
      setDocuments([]);
      activate(chat.id);

      if (window.innerWidth <= 860) setSidebarOpen(false);
      textareaRef.current?.focus();
    } catch (error) {
      toast(error.message);
    }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const list = await (await request("/conversations")).json();
        setConversations(list);

        const saved = localStorage.getItem(STORAGE_KEY);
        const pick = list.find((c) => c.id === saved) || list[0];

        if (pick) activate(pick.id);
        else await createChat({ force: true });
      } catch {
        toast("Can't reach the server. Is the backend running?");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;

    (async () => {
      try {
        const [msgs, docs] = await Promise.all([
          request(`/conversations/${conversationId}/messages`).then((r) =>
            r.json()
          ),
          request(`/conversations/${conversationId}/documents`).then((r) =>
            r.json()
          ),
        ]);
        if (cancelled) return;
        setMessages(msgs);
        setDocuments(docs);
      } catch (error) {
        if (!cancelled) toast(error.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: loading ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, loading]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  // ---------- conversations ----------

  const selectConversation = (id) => {
    if (id === conversationId) return;
    abortRef.current?.abort();
    setMessages([]);
    setDocuments([]);
    activate(id);
    if (window.innerWidth <= 860) setSidebarOpen(false);
  };

  const deleteChat = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm("Delete this chat and its documents?")) return;

    try {
      await request(`/conversations/${id}`, { method: "DELETE" });

      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);

      if (conversationId === id) {
        if (remaining.length > 0) {
          setMessages([]);
          setDocuments([]);
          activate(remaining[0].id);
        } else {
          await createChat({ force: true });
        }
      }
    } catch (error) {
      toast(error.message);
    }
  };

  // ---------- documents ----------

  const uploadDocument = async (file) => {
    if (!file || !conversationId) return;

    const extension = `.${file.name.split(".").pop().toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      toast("Only PDF, DOCX and TXT files are supported.");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast(`Files must be under ${MAX_UPLOAD_MB} MB.`);
      return;
    }

    const id = conversationId;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      await request(`/conversations/${id}/documents`, {
        method: "POST",
        body: formData,
      });

      const docs = await (await request(`/conversations/${id}/documents`)).json();
      if (activeRef.current === id) setDocuments(docs);
    } catch (error) {
      toast(error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = async (doc) => {
    try {
      await request(`/conversations/${conversationId}/documents/${doc.id}`, {
        method: "DELETE",
      });
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (error) {
      toast(error.message);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) uploadDocument(file);
    event.target.value = "";
  };

  // ---------- drag & drop ----------

  const hasFiles = (event) => event.dataTransfer?.types?.includes("Files");

  const onDragEnter = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragLeave = (event) => {
    if (!hasFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) uploadDocument(file);
  };

  // ---------- chat ----------

  const stopGenerating = () => abortRef.current?.abort();

  const sendMessage = async (override) => {
    const text = (typeof override === "string" ? override : input).trim();
    if (!text || loading || uploading || !conversationId) return;

    const id = conversationId;
    const controller = new AbortController();
    abortRef.current = controller;

    setInput("");
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "", sources: [] },
    ]);

    let aiText = "";

    try {
      const response = await request("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: id, usermsg: text }),
        signal: controller.signal,
      });

      let sources = [];
      try {
        const header = response.headers.get("X-Sources");
        if (header) sources = JSON.parse(decodeURIComponent(header));
      } catch {
        /* ignore malformed header */
      }

      if (!response.body) throw new Error("Streaming is not supported.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        aiText += decoder.decode(value, { stream: true });

        if (activeRef.current === id) {
          setMessages((prev) =>
            replaceLast(prev, { role: "assistant", content: aiText, sources })
          );
        }
      }
    } catch (error) {
      if (activeRef.current === id) {
        if (error.name === "AbortError") {
          // Keep whatever streamed so far; drop the bubble if nothing did.
          if (!aiText) setMessages((prev) => prev.slice(0, -1));
        } else {
          setMessages((prev) =>
            replaceLast(prev, {
              role: "assistant",
              content: "Sorry, something went wrong. Please try again.",
              sources: [],
            })
          );
        }
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      refreshSidebar();
      setTimeout(refreshSidebar, 2500); // pick up the LLM-generated title
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  // ---------- render ----------

  const activeChat = conversations.find((c) => c.id === conversationId);
  const groups = groupConversations(conversations);
  const lastMessage = messages[messages.length - 1];

  return (
    <div
      className={`app ${sidebarOpen ? "" : "sidebar-closed"}`}
      onDragEnter={onDragEnter}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="scrim" onClick={() => setSidebarOpen(false)} />

      {/* ============ SIDEBAR ============ */}
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark" />
            {APP_NAME}
          </div>
          <button
            className="icon-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <Icon name="panel" />
          </button>
        </div>

        <button className="new-chat" onClick={() => createChat()}>
          <Icon name="plus" />
          New chat
        </button>

        <nav className="conversation-list">
          {groups.map(([label, items]) => (
            <div key={label} className="conversation-group">
              <div className="group-label">{label}</div>

              {items.map((chat) => (
                <div
                  key={chat.id}
                  className={`conversation-item ${
                    chat.id === conversationId ? "active" : ""
                  }`}
                  onClick={() => selectConversation(chat.id)}
                >
                  <span className="conversation-title">{chat.title}</span>
                  <button
                    className="delete-chat"
                    onClick={(e) => deleteChat(chat.id, e)}
                    aria-label="Delete chat"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">Documents stay private to each chat.</div>
      </aside>

      {/* ============ MAIN ============ */}
      <main className="main">
        <header className="topbar">
          {!sidebarOpen && (
            <button
              className="icon-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Icon name="panel" />
            </button>
          )}
          <div className="topbar-title">{activeChat?.title || APP_NAME}</div>
        </header>

        <div className="thread">
          <div className="thread-inner">
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-mark" />
                <h1>How can I help today?</h1>
                <p>Ask anything, or attach a document and I'll answer from it.</p>

                <div className="suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="suggestion"
                      onClick={() => sendMessage(suggestion)}
                      disabled={!conversationId}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <Message
                  key={index}
                  message={message}
                  streaming={
                    loading &&
                    index === messages.length - 1 &&
                    message.role === "assistant"
                  }
                />
              ))
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* ============ COMPOSER ============ */}
        <div className="composer-wrap">
          <div className="composer-inner">
            {(documents.length > 0 || uploading) && (
              <div className="attachments">
                {documents.map((doc) => (
                  <div key={doc.id} className="attachment">
                    <Icon name="file" size={14} />
                    <span className="attachment-name">{doc.filename}</span>
                    {doc.size > 0 && (
                      <span className="attachment-meta">
                        {formatSize(doc.size)}
                      </span>
                    )}
                    <button
                      onClick={() => removeDocument(doc)}
                      aria-label={`Remove ${doc.filename}`}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ))}

                {uploading && (
                  <div className="attachment indexing">
                    <span className="spinner" />
                    Indexing…
                  </div>
                )}
              </div>
            )}

            <div className="composer">
              <button
                className="icon-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !conversationId}
                aria-label="Attach document"
              >
                <Icon name="paperclip" size={18} />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_EXTENSIONS.join(",")}
                onChange={handleFileChange}
                hidden
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  uploading ? "Indexing document…" : `Message ${APP_NAME}`
                }
                rows={1}
              />

              {loading ? (
                <button
                  className="send stop"
                  onClick={stopGenerating}
                  aria-label="Stop generating"
                >
                  <span />
                </button>
              ) : (
                <button
                  className="send"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || uploading || !conversationId}
                  aria-label="Send message"
                >
                  <Icon name="arrowUp" size={18} />
                </button>
              )}
            </div>

            <p className="hint">
              Enter to send · Shift+Enter for a new line · PDF, DOCX, TXT up to{" "}
              {MAX_UPLOAD_MB} MB
            </p>
          </div>
        </div>

        {dragging && (
          <div className="drop-overlay">
            <Icon name="upload" size={28} />
            <span>Drop a document to add it to this chat</span>
          </div>
        )}
      </main>

      {/* ============ TOASTS ============ */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}