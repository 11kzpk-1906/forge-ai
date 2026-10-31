import React, { useEffect, useRef, useState } from "react";
const logoUrl = new URL("../assets/logo.svg", import.meta.url).href;
import { ParticleField } from "../components/ParticleField";
import { ThinkingTimeline } from "../components/ThinkingTimeline";
import { useAuth } from "./providers/AuthProvider";
import { useChat } from "../features/chat/hooks/useChat";
import { MemoryPanel } from "../features/memory/MemoryPanel";
import {
  deleteConversation,
  getConversationMessages,
  listConversations,
  type Conversation,
} from "../features/conversations/api/conversations.api";

type Mode =
  | "Explain"
  | "Debug"
  | "Architect"
  | "Review"
  | "Implement"
  | "Test"
  | "Security"
  | "DevOps"
  | "Research";

const personalities = [
  { id: "friendly_engineer", label: "Friendly Engineer", description: "Warm, practical, and conversational" },
  { id: "senior_engineer", label: "Senior Engineer", description: "Precise and production-minded" },
  { id: "mentor", label: "Mentor", description: "Teaches while solving" },
  { id: "fast_coder", label: "Fast Coder", description: "Concise and implementation-first" },
  { id: "architect", label: "Architect", description: "Systems and trade-offs focused" },
  { id: "pair_programmer", label: "Pair Programmer", description: "Collaborative and iterative" },
];

type Personality = (typeof personalities)[number]["id"];

const modes: Mode[] = [
  "Explain",
  "Debug",
  "Architect",
  "Review",
  "Implement",
  "Test",
  "Security",
  "DevOps",
  "Research",
];

const starterCards: Array<{
  icon: string;
  title: string;
  mode: Mode;
}> = [
  { icon: "⌁", title: "Debug this React error", mode: "Debug" },
  { icon: "◇", title: "Design a scalable REST API", mode: "Architect" },
  { icon: "⌕", title: "Review this function", mode: "Review" },
  { icon: "▱", title: "Explain this system design", mode: "Explain" },
  { icon: "⚗", title: "Write unit tests", mode: "Implement" },
  { icon: "⑂", title: "Plan a CI/CD pipeline", mode: "Architect" },
];

const visibleModes: Mode[] = [
  "Explain",
  "Debug",
  "Architect",
  "Review",
  "Implement",
];

function createConversationTitle(message: string) {
  const cleaned = message
    .replace(/\s+/g, " ")
    .replace(/[`*_#]/g, "")
    .trim();

  if (!cleaned) return "New conversation";

  const words = cleaned.split(" ");
  return words.length <= 7
    ? cleaned
    : words.slice(0, 7).join(" ") + "…";
}

function modeLabel(mode: Mode) {
  return mode.toUpperCase() + " MODE";
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|_[^_]+_|\x60[^\x60]+\x60|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  return text.split(pattern).map((token, index) => {
    const key = keyPrefix + "-" + index;
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={key}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("~~") && token.endsWith("~~")) return <del key={key}>{token.slice(2, -2)}</del>;
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) return <em key={key}>{token.slice(1, -1)}</em>;
    if (token.startsWith("`") && token.endsWith("`")) return <code className="inline-code" key={key}>{token.slice(1, -1)}</code>;
    if (token.startsWith("[") && token.includes("](")) {
      const match = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (match) return <a key={key} href={match[2]} target="_blank" rel="noreferrer noopener">{match[1]}</a>;
    }
    return <React.Fragment key={key}>{token}</React.Fragment>;
  });
}

function renderMessageContent(content: string, onCopyCode: (code: string, id: string) => void, copiedCode: string | null) {
  const blocks = content.split(/(```[^\n]*\n[\s\S]*?```)/g);
  return blocks.map((block, blockIndex) => {
    if (block.startsWith("```") && block.endsWith("```")) {
      const lines = block.slice(3, -3).replace(/^\r?\n/, "").split(/\r?\n/);
      const language = lines.shift()?.trim() || "code";
      const code = lines.join("\n").replace(/\n$/, "");
      const codeId = blockIndex + "-" + code.slice(0, 40);
      return <div className="code-block" key={blockIndex}>
        <div className="code-block-header"><div className="code-file-tab"><span className="code-file-dot" /><span>{language}</span></div>
          <button className="code-copy-button" onClick={() => onCopyCode(code, codeId)}>{copiedCode === codeId ? "Copied" : "Copy"}</button>
        </div>
        <div className="code-editor"><div className="code-line-numbers" aria-hidden="true">{code.split("\n").map((_, i) => <span key={i}>{i + 1}</span>)}</div><pre><code>{code}</code></pre></div>
      </div>;
    }
    const lines = block.replace(/\r/g, "").split("\n");
    const output: React.ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        const Tag = ("h" + level) as React.ElementType;
        output.push(<Tag className={"rich-heading rich-heading-" + level} key={blockIndex + "-h-" + i}>{renderInline(heading[2], blockIndex + "-h-" + i)}</Tag>);
        i++; continue;
      }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { output.push(<hr className="rich-divider" key={blockIndex + "-hr-" + i} />); i++; continue; }
      if (/^>\s?/.test(line)) {
        const quote: string[] = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
        output.push(<blockquote className="rich-quote" key={blockIndex + "-q-" + i}>{quote.map((q,j)=><p key={j}>{renderInline(q, blockIndex + "-q-" + i + "-" + j)}</p>)}</blockquote>);
        continue;
      }
      if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
        const ordered = /^\s*\d+[.)]\s+/.test(line);
        const items: string[] = [];
        const matcher = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
        while (i < lines.length && matcher.test(lines[i])) items.push(lines[i++].replace(matcher, ""));
        const List = ordered ? "ol" : "ul";
        output.push(<List className="rich-list" key={blockIndex + "-list-" + i}>{items.map((item,j)=><li key={j}>{renderInline(item, blockIndex + "-li-" + i + "-" + j)}</li>)}</List>);
        continue;
      }
      if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
        const cells = (value: string) => value.trim().replace(/^\||\|$/g, "").split("|").map(cell=>cell.trim());
        const headers = cells(line); i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
        output.push(<div className="rich-table-wrap" key={blockIndex + "-table-" + i}><table className="rich-table"><thead><tr>{headers.map((cell,j)=><th key={j}>{renderInline(cell, "th"+j)}</th>)}</tr></thead><tbody>{rows.map((row,j)=><tr key={j}>{headers.map((_,k)=><td key={k}>{renderInline(row[k] || "", "td"+j+"-"+k)}</td>)}</tr>)}</tbody></table></div>);
        continue;
      }
      const paragraph: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s+/.test(lines[i]) && !/^\s*(---+|\*\*\*+)\s*$/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) paragraph.push(lines[i++]);
      output.push(<p className="rich-paragraph" key={blockIndex + "-p-" + i}>{renderInline(paragraph.join(" "), blockIndex + "-p-" + i)}</p>);
    }
    return <React.Fragment key={blockIndex}>{output}</React.Fragment>;
  });
}

function App() {
  const { user, signOut } = useAuth();
  const {
    messages,
    isStreaming,
    sendMessage,
    replaceMessages,
    clearMessages,
  } = useChat();

  const [message, setMessage] = useState("");
  const [personality, setPersonality] = useState<Personality>(() => {
    const saved = localStorage.getItem("forgeai-personality");
    return personalities.some((item) => item.id === saved)
      ? (saved as Personality)
      : "friendly_engineer";
  });
  const [mode, setMode] = useState<Mode>(() => {
    const saved = localStorage.getItem("forgeai-default-mode");
    return modes.includes(saved as Mode) ? (saved as Mode) : "Explain";
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] =
    useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showAllModes, setShowAllModes] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [autoHideSidebar, setAutoHideSidebar] = useState(() => localStorage.getItem("forgeai-sidebar-autohide") === "true");
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("forgeai-theme");
    return saved === "light" || saved === "dim" ? "light" : "dark";
  });
  const [compactMessages, setCompactMessages] = useState(
    () => localStorage.getItem("forgeai-compact-messages") === "true",
  );
  const [showKeyboardHints, setShowKeyboardHints] = useState(
    () => localStorage.getItem("forgeai-keyboard-hints") !== "false",
  );
  const [reducedMotion, setReducedMotion] = useState(
    () => localStorage.getItem("forgeai-reduced-motion") === "true",
  );
  const sidebarTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isStreaming) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  useEffect(() => {
    localStorage.setItem("forgeai-sidebar-autohide", String(autoHideSidebar));
  }, [autoHideSidebar]);

  useEffect(() => {
    localStorage.setItem("forgeai-theme", theme);
    document.documentElement.dataset.forgeaiTheme = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("forgeai-compact-messages", String(compactMessages));
  }, [compactMessages]);

  useEffect(() => {
    localStorage.setItem("forgeai-keyboard-hints", String(showKeyboardHints));
  }, [showKeyboardHints]);

  useEffect(() => {
    localStorage.setItem("forgeai-reduced-motion", String(reducedMotion));
    document.documentElement.dataset.forgeaiReducedMotion = String(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    localStorage.setItem("forgeai-personality", personality);
  }, [personality]);

  useEffect(() => {
    localStorage.setItem("forgeai-default-mode", mode);
  }, [mode]);

  useEffect(() => {
    if (!autoHideSidebar || sidebarHidden) return;
    sidebarTimerRef.current = window.setTimeout(() => setSidebarHidden(true), 5000);
    return () => {
      if (sidebarTimerRef.current) window.clearTimeout(sidebarTimerRef.current);
    };
  }, [autoHideSidebar, sidebarHidden]);

  const revealSidebar = () => {
    if (sidebarTimerRef.current) window.clearTimeout(sidebarTimerRef.current);
    setSidebarHidden(false);
  };

  const hideSidebar = () => {
    if (sidebarTimerRef.current) window.clearTimeout(sidebarTimerRef.current);
    setSidebarHidden(true);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        setLoadingHistory(true);
        const items = await listConversations();
        if (!cancelled) setConversations(items);
      } catch (error) {
        if (!cancelled) {
          setHistoryError(
            error instanceof Error
              ? error.message
              : "Could not load chat history.",
          );
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectConversation = async (
    conversation: Conversation,
  ) => {
    if (isStreaming || activeConversationId === conversation.id) return;

    try {
      setHistoryError(null);
      const storedMessages = await getConversationMessages(conversation.id);

      replaceMessages(
        storedMessages.map((item) => ({
          role: item.role,
          content: item.content,
        })),
      );

      setActiveConversationId(conversation.id);

      const matchingMode = modes.find(
        (item) =>
          item.toLowerCase() === conversation.mode.toLowerCase(),
      );
      if (matchingMode) setMode(matchingMode);
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Could not load this conversation.",
      );
    }
  };

  const handleMessageChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const textarea = event.target;
    setMessage(textarea.value);
    textarea.style.height = "auto";
    textarea.style.height =
      Math.min(textarea.scrollHeight, 220) + "px";
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isStreaming) return;

    setMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "76px";

    const title = createConversationTitle(trimmedMessage);

    await sendMessage(
      trimmedMessage,
      mode.toLowerCase(),
      personality,
      activeConversationId,
      (conversation) => {
        setActiveConversationId(conversation.id);
        setConversations((current) => {
          const exists = current.some((item) => item.id === conversation.id);
          if (exists) {
            return current.map((item) =>
              item.id === conversation.id
                ? {
                    ...item,
                    title: conversation.title,
                    updated_at: conversation.updated_at,
                  }
                : item,
            );
          }
          return [conversation, ...current];
        });
      },
      (conversationId, aiTitle) => {
        setConversations((current) =>
          current
            .map((item) =>
              item.id === conversationId
                ? {
                    ...item,
                    title: aiTitle,
                    updated_at: new Date().toISOString(),
                  }
                : item,
            )
            .sort(
              (a, b) =>
                new Date(b.updated_at).getTime() -
                new Date(a.updated_at).getTime(),
            ),
        );
      },
      (conversationId) => {
        if (!conversationId) return;
        setActiveConversationId(conversationId);
        setConversations((current) =>
          current
            .map((item) =>
              item.id === conversationId
                ? {
                    ...item,
                    title:
                      item.title === "New conversation"
                        ? title
                        : item.title,
                    updated_at: new Date().toISOString(),
                  }
                : item,
            )
            .sort(
              (a, b) =>
                new Date(b.updated_at).getTime() -
                new Date(a.updated_at).getTime(),
            ),
        );
      },
    );
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey && showKeyboardHints) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(id);
      window.setTimeout(() => setCopiedCode(null), 1400);
    } catch {
      setCopiedCode(null);
    }
  };

  const handleCopyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessage(index);
      window.setTimeout(() => setCopiedMessage(null), 1400);
    } catch {
      setCopiedMessage(null);
    }
  };

  const handleEditMessage = (content: string) => {
    setMessage(content);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 220) + "px";
    });
  };

  const handleDeleteConversation = async (conversation: Conversation) => {
    if (isStreaming) return;

    const confirmed = window.confirm(
      'Delete "' + conversation.title + '"? This will permanently remove the chat and its messages.',
    );
    if (!confirmed) return;

    try {
      setHistoryError(null);
      await deleteConversation(conversation.id);
      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id),
      );

      if (activeConversationId === conversation.id) {
        clearMessages();
        setActiveConversationId(null);
        setMessage("");
      }
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Could not delete this conversation.",
      );
    }
  };

  const handleNewChat = () => {
    if (isStreaming) return;
    clearMessages();
    setActiveConversationId(null);
    setHistoryError(null);
    setShowSettings(false);
    setShowMemory(false);
    setMessage("");
  };

  const filteredConversations = [...conversations]
    .filter((conversation) =>
      conversation.title
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime(),
    );

  const handleStarter = (card: (typeof starterCards)[number]) => {
    setMode(card.mode);
    setMessage(card.title + ": ");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const commandActions = [
    { id: "new-chat", label: "Start a new chat", detail: "Clear the current conversation", icon: "＋", run: handleNewChat },
    { id: "memory", label: "Open Memory Vault", detail: "Review saved context and memories", icon: "◇", run: () => { setShowMemory(true); setShowSettings(false); } },
    { id: "settings", label: "Open settings", detail: "Personalize your workspace", icon: "⚙", run: () => { setShowSettings(true); setShowMemory(false); } },
    { id: "sidebar", label: sidebarHidden ? "Show sidebar" : "Hide sidebar", detail: "Toggle navigation panel", icon: "☷", run: () => sidebarHidden ? revealSidebar() : hideSidebar() },
    { id: "theme", label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme", detail: "Change workspace appearance", icon: "◐", run: () => setTheme(theme === "dark" ? "light" : "dark") },
    { id: "focus", label: "Focus message composer", detail: "Jump straight to your prompt", icon: "↵", run: () => { setShowSettings(false); setShowMemory(false); requestAnimationFrame(() => textareaRef.current?.focus()); } },
    ...modes.map((item) => ({ id: "mode-" + item, label: item + " mode", detail: "Set ForgeAI engineering mode", icon: "⌘", run: () => { setMode(item); setShowSettings(false); setShowMemory(false); requestAnimationFrame(() => textareaRef.current?.focus()); } })),
  ];
  const filteredCommands = commandActions.filter((item) =>
    (item.label + " " + item.detail).toLowerCase().includes(commandQuery.trim().toLowerCase())
  );

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
        setCommandQuery("");
        setCommandIndex(0);
      } else if (event.key === "Escape") {
        setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (commandOpen) requestAnimationFrame(() => commandInputRef.current?.focus());
  }, [commandOpen]);

  useEffect(() => {
    setCommandIndex(0);
  }, [commandQuery]);

  return (
    <div className={theme === "dark" ? "app-shell theme-dark" : "app-shell theme-light"}>
      <aside
        className={sidebarHidden ? "sidebar sidebar-hidden" : "sidebar"}
        onMouseEnter={revealSidebar}
      >
        <div className="sidebar-top">
          <div className="brand-lockup">
            <div className="brand-mark">
              <img src={logoUrl} alt="" />
            </div>
            <div className="brand-copy">
              <div className="brand-name">ForgeAI</div>
              <div className="brand-kicker">ENGINEERING COPILOT</div>
            </div>
          </div>

          <button
            className="new-chat-button"
            onClick={handleNewChat}
            disabled={isStreaming}
          >
            <span>＋</span>
            <strong>New chat</strong>
            <kbd>⌘ K</kbd>
          </button>

          <button
            className={showMemory ? "memory-nav-button active" : "memory-nav-button"}
            onClick={() => { setShowMemory(true); setShowSettings(false); }}
            aria-current={showMemory ? "page" : undefined}
          >
            <span className="memory-nav-icon">◇</span>
            <span>Memory vault</span>
            <span className="memory-nav-arrow">↗</span>
          </button>

          <div className="sidebar-section-label">RECENT</div>
          <button className="recent-empty-card" onClick={handleNewChat}>
            <span className="recent-empty-icon">◌</span>
            <span>
              <strong>Explore a new idea</strong>
              <small>Start a fresh conversation</small>
            </span>
          </button>

          <label className="chat-search">
            <span className="search-icon">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats"
              aria-label="Search chats"
            />
            <button className="search-shortcut" type="button" onClick={() => { setCommandOpen(true); setCommandQuery(""); }} aria-label="Open command center">⌘K</button>
          </label>

          <div className="history">
            {loadingHistory ? (
              <div className="history-empty">Loading chats…</div>
            ) : filteredConversations.length === 0 ? (
              <div className="history-empty">
                {search
                  ? "No matching chats."
                  : "No chats yet. Start one above."}
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={
                    activeConversationId === conversation.id
                      ? "history-item active"
                      : "history-item"
                  }
                  role="button"
                  tabIndex={isStreaming ? -1 : 0}
                  onClick={() => void handleSelectConversation(conversation)}
                  onKeyDown={(event) => {
                    if ((event.key === "Enter" || event.key === " ") && !isStreaming) {
                      event.preventDefault();
                      void handleSelectConversation(conversation);
                    }
                  }}
                  aria-label={"Open conversation " + conversation.title}
                >
                  <span className="history-dot">•</span>
                  <span className="history-title">{conversation.title}</span>
                  <button
                    className="history-delete-button"
                    type="button"
                    title="Delete chat"
                    aria-label={"Delete " + conversation.title}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeleteConversation(conversation);
                    }}
                    disabled={isStreaming}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-account">
          <div className="plan-card">
            <div className="plan-card-top"><span>Free plan</span><strong>7 / 10</strong></div>
            <div className="plan-progress"><span /></div>
          </div>
          <button className="sidebar-settings-button" title="Settings" onClick={() => { setShowSettings(true); setShowMemory(false); }}>⚙</button>
        </div>
      </aside>

      <main className="workspace">
        <ParticleField />
        <header className="workspace-header">
          <div className="workspace-title">
            <span className="workspace-title-mark">/</span>
            <strong>
              {showMemory
                ? "Memory vault"
                : showSettings
                  ? "Settings"
                  : messages.length > 0
                    ? conversations.find(
                        (item) => item.id === activeConversationId,
                      )?.title ?? "New chat"
                    : "New chat"}
            </strong>
          </div>

          <div className="header-actions">
            <span className="demo-pill">
              <span>●</span>
              Demo mode
            </span>
            <button
              className="header-icon-button"
              title="New chat"
              onClick={handleNewChat}
            >
              ＋
            </button>
            <button
              className="header-icon-button sidebar-toggle-button"
              title={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
              onClick={sidebarHidden ? revealSidebar : hideSidebar}
            >
              {sidebarHidden ? "☰" : "‹"}
            </button>
            <button
              className="header-icon-button"
              title="Settings"
              onClick={() => { setShowSettings((value) => !value); setShowMemory(false); }}
            >
              ⚙
            </button>
          </div>
        </header>

        {commandOpen && (
          <div className="command-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
            <section className="command-palette" role="dialog" aria-modal="true" aria-label="ForgeAI command center">
              <div className="command-search-row">
                <span className="command-search-icon">⌕</span>
                <input
                  ref={commandInputRef}
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") { event.preventDefault(); setCommandIndex((index) => Math.min(index + 1, Math.max(filteredCommands.length - 1, 0))); }
                    if (event.key === "ArrowUp") { event.preventDefault(); setCommandIndex((index) => Math.max(index - 1, 0)); }
                    if (event.key === "Enter" && filteredCommands[commandIndex]) { event.preventDefault(); filteredCommands[commandIndex].run(); setCommandOpen(false); }
                  }}
                  placeholder="Search commands, modes, and actions..."
                  aria-label="Search commands"
                />
                <kbd>ESC</kbd>
              </div>
              <div className="command-section-label">QUICK ACTIONS</div>
              <div className="command-results">
                {filteredCommands.length ? filteredCommands.map((item, index) => (
                  <button
                    key={item.id}
                    className={index === commandIndex ? "command-result active" : "command-result"}
                    onMouseEnter={() => setCommandIndex(index)}
                    onClick={() => { item.run(); setCommandOpen(false); }}
                  >
                    <span className="command-result-icon">{item.icon}</span>
                    <span className="command-result-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
                    {index === commandIndex && <kbd>↵</kbd>}
                  </button>
                )) : <div className="command-empty">No matching commands. Try “memory”, “theme”, or a mode.</div>}
              </div>
              <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Run command</span><span><kbd>ESC</kbd> Close</span></footer>
            </section>
          </div>
        )}

        {showMemory ? (
          <MemoryPanel conversationId={activeConversationId} />
        ) : showSettings ? (
          <section className="settings-panel">
            <div className="settings-heading">
              <span>FORGEAI</span>
              <h1>Settings</h1>
              <p>Configure the workspace without leaving your chat.</p>
            </div>
            <div className="settings-grid">
              <div className="settings-card">
                <span className="settings-card-label">ACCOUNT</span>
                <strong>{user?.email ?? "Signed in"}</strong>
                <p>Your ForgeAI account and chat history.</p>
              </div>
              <div className="settings-card">
                <span className="settings-card-label">AI PROVIDER</span>
                <strong>Groq</strong>
                <p>Server-side provider connection.</p>
                <span className="connected-badge">Connected</span>
              </div>
              <div className="settings-card settings-control-card">
                <span className="settings-card-label">PERSONALITY</span>
                <strong>{personalities.find((item) => item.id === personality)?.label}</strong>
                <p>{personalities.find((item) => item.id === personality)?.description}</p>
                <select
                  value={personality}
                  onChange={(event) => setPersonality(event.target.value as Personality)}
                  className="settings-select"
                >
                  {personalities.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div className="settings-card settings-control-card">
                <span className="settings-card-label">DEFAULT MODE</span>
                <strong>{mode}</strong>
                <p>Choose the mode used for new prompts.</p>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as Mode)}
                  className="settings-select"
                >
                  {modes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="settings-card settings-control-card">
                <span className="settings-card-label">APPEARANCE</span>
                <strong>{theme === "dark" ? "Dark" : "Light"}</strong>
                <p>Adjust the workspace contrast.</p>
                <div className="settings-segment">
                  <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>Dark</button>
                  <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>Light</button>
                </div>
              </div>
              <div className="settings-card settings-control-card">
                <span className="settings-card-label">INTERFACE</span>
                <strong>Sidebar behavior</strong>
                <p>Automatically hide the sidebar after inactivity.</p>
                <button className={autoHideSidebar ? "settings-toggle on" : "settings-toggle"} onClick={() => setAutoHideSidebar((value) => !value)}>
                  <span>{autoHideSidebar ? "ON" : "OFF"}</span>
                  <i />
                </button>
              </div>
              <div className="settings-card settings-control-card">
                <span className="settings-card-label">CHAT DISPLAY</span>
                <strong>Compact messages</strong>
                <p>Reduce spacing between conversation messages.</p>
                <button className={compactMessages ? "settings-toggle on" : "settings-toggle"} onClick={() => setCompactMessages((value) => !value)}>
                  <span>{compactMessages ? "ON" : "OFF"}</span>
                  <i />
                </button>
              </div>
              <div className="settings-card settings-control-card">
                <span className="settings-card-label">KEYBOARD</span>
                <strong>Enter to send</strong>
                <p>Press Enter to send and Shift+Enter for a newline.</p>
                <button className={showKeyboardHints ? "settings-toggle on" : "settings-toggle"} onClick={() => setShowKeyboardHints((value) => !value)}>
                  <span>{showKeyboardHints ? "ON" : "OFF"}</span>
                  <i />
                </button>
              </div>
              <div className="settings-card settings-control-card">
                <span className="settings-card-label">ACCESSIBILITY</span>
                <strong>Reduce motion</strong>
                <p>Reduce UI transitions and particle movement.</p>
                <button className={reducedMotion ? "settings-toggle on" : "settings-toggle"} onClick={() => setReducedMotion((value) => !value)}>
                  <span>{reducedMotion ? "ON" : "OFF"}</span>
                  <i />
                </button>
              </div>
              <div className="settings-card settings-control-card">
                <span className="settings-card-label">PREFERENCES</span>
                <strong>Reset ForgeAI settings</strong>
                <p>Restore theme, mode, interface, display, and keyboard defaults.</p>
                <button
                  className="settings-reset-button"
                  onClick={() => {
                    localStorage.removeItem("forgeai-theme");
                    localStorage.removeItem("forgeai-personality");
                    localStorage.removeItem("forgeai-default-mode");
                    localStorage.removeItem("forgeai-sidebar-autohide");
                    localStorage.removeItem("forgeai-compact-messages");
                    localStorage.removeItem("forgeai-keyboard-hints");
                    localStorage.removeItem("forgeai-reduced-motion");
                    setTheme("dark");
                    setPersonality("friendly_engineer");
                    setMode("Explain");
                    setAutoHideSidebar(false);
                    setCompactMessages(false);
                    setShowKeyboardHints(true);
                    setReducedMotion(false);
                    setSidebarHidden(false);
                  }}
                >
                  Reset settings
                </button>
              </div>
            </div>
            <button className="settings-signout" onClick={() => void signOut()}>
              Sign out
            </button>
          </section>
        ) : messages.length === 0 ? (
          <section className="welcome-workspace">
            <div className="grid-overlay" />

            <div className="welcome-content">
              <div className="welcome-ai-mark">
                <img src={logoUrl} alt="ForgeAI" />
              </div>
              <h1 className="welcome-title">
                <span>What can we imagine</span>{" "}
                <em>together?</em>
              </h1>
              <p className="welcome-description">
                Your AI engineering workspace. Debug, design, research, and build with a copilot that thinks in systems.
              </p>
              <div className="welcome-workspace-meta"><span><i /> SYSTEM READY</span><span>GROQ ENGINE</span><button type="button" onClick={() => { setCommandOpen(true); setCommandQuery(""); }}>⌘K COMMAND CENTER</button></div>
              <div className="starter-grid">
                {starterCards.map((card) => (
                  <button className="starter-card" key={card.title} onClick={() => handleStarter(card)}>
                    <span className="starter-icon">{card.icon}</span>
                    <span className="starter-copy"><strong>{card.title}</strong><small>{card.mode} workflow</small></span>
                    <span className="starter-arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className={compactMessages ? "messages messages-compact" : "messages"}>
            {messages.map((item, index) => {
              const isUser = item.role === "user";
              const isLastMessage = index === messages.length - 1;

              return (
                <div
                  key={item.role + "-" + index}
                  className={
                    isUser
                      ? "message-row message-row-user"
                      : "message-row message-row-assistant"
                  }
                >
                  <div className="message-meta">
                    <span className={isUser ? "role-chip user" : "role-chip"}>
                      {isUser ? "YOU" : "FORGEAI"}
                    </span>
                  </div>
                  <div className="message-bubble-wrap">
                    <div
                      className={
                        isUser
                          ? "message-content user-content"
                          : "message-content"
                      }
                    >
                      {item.content
                        ? renderMessageContent(item.content, handleCopyCode, copiedCode)
                        : isStreaming && isLastMessage
                          ? <ThinkingTimeline />
                          : null}
                    </div>
                    {item.content && (
                      <div className="message-actions">
                        <button
                          title="Copy message"
                          onClick={() => void handleCopyMessage(item.content, index)}
                        >
                          {copiedMessage === index ? "Copied" : "Copy"}
                        </button>
                        {isUser && (
                          <button
                            title="Edit prompt"
                            onClick={() => handleEditMessage(item.content)}
                            disabled={isStreaming}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {historyError && <div className="history-error">{historyError}</div>}
            <div ref={messagesEndRef} aria-hidden="true" />
          </section>
        )}

        {!showSettings && !showMemory && (
          <section className="composer-area">
            <div className="composer-mode-row">
              <div className="mode-segment">
                {visibleModes.map((item) => (
                  <button
                    key={item}
                    className={mode === item ? "mode-pill selected" : "mode-pill"}
                    onClick={() => setMode(item)}
                    disabled={isStreaming}
                  >
                    {item}
                  </button>
                ))}
                <button
                  className="mode-more"
                  onClick={() => setShowAllModes((value) => !value)}
                  disabled={isStreaming}
                  title="More engineering modes"
                >
                  ···
                </button>
                {showAllModes && (
                  <div className="mode-popover">
                    {modes.map((item) => (
                      <button
                        key={item}
                        className={mode === item ? "mode-popover-item active" : "mode-popover-item"}
                        onClick={() => {
                          setMode(item);
                          setShowAllModes(false);
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {showKeyboardHints && <span className="keyboard-hint">
                Enter to send · Shift+Enter for newline
              </span>}
            </div>

            <div className={composerExpanded ? "composer composer-expanded" : "composer"}>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleMessageChange}
                onKeyDown={handleKeyDown}
                placeholder="Describe the bug, paste the code, or ask for a design..."
                rows={3}
                disabled={isStreaming}
              />
              <div className="composer-bottom">
                <div className="composer-context">
                  <span>⌕</span>
                  <span>{mode}</span>
                </div>
                <div className="composer-actions">
                  <button className="composer-icon-button" type="button" title="Attach">⌕</button>
                  <button className="composer-voice-button" type="button" title="Voice input">◉</button>
                  <button
                    className="send-button"
                    disabled={!message.trim() || isStreaming}
                    onClick={() => void handleSend()}
                  >
                    <span>↑</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="composer-tags">
              <button className={mode === "Explain" ? "composer-tag active" : "composer-tag"} onClick={() => setMode("Explain")}>Adaptive</button>
              <button className={mode === "Architect" ? "composer-tag active" : "composer-tag"} onClick={() => setMode("Architect")}>Think</button>
              <button className={mode === "Research" ? "composer-tag active" : "composer-tag"} onClick={() => setMode("Research")} aria-pressed={mode === "Research"}>Research</button>
              <button className={mode === "Implement" ? "composer-tag active" : "composer-tag"} onClick={() => setMode("Implement")}>Create</button>
            </div>
            <p className="composer-disclaimer">
              ForgeAI can make mistakes. Check important information. <span>?</span>
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
