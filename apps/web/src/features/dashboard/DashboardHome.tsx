import React, { useEffect, useMemo, useState } from "react";
import type { Conversation } from "../conversations/api/conversations.api";

type ProjectPreview = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  stack?: string;
  tasks?: Array<{ id: string; done: boolean }>;
  updatedAt?: string;
};

const modeCards = [
  { name: "Explain", icon: "</>", caption: "Understand complex code", tone: "violet" },
  { name: "Debug", icon: "⌁", caption: "Find and fix issues", tone: "blue" },
  { name: "Architect", icon: "⬡", caption: "Design better systems", tone: "cyan" },
  { name: "Implement", icon: "ϟ", caption: "Turn ideas into code", tone: "green" },
  { name: "Review", icon: "◇", caption: "Improve code quality", tone: "orange" },
  { name: "Test", icon: "⚗", caption: "Build reliable software", tone: "pink" },
  { name: "DevOps", icon: "☁", caption: "Ship and scale", tone: "indigo" },
  { name: "Security", icon: "⬡", caption: "Build with confidence", tone: "amber" },
  { name: "Research", icon: "⌕", caption: "Explore technical topics", tone: "teal" },
] as const;

function loadProjectPreviews(storageKey: string): ProjectPreview[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string" && typeof item.name === "string") : [];
  } catch {
    return [];
  }
}

function timeAgo(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : days + "d ago";
}

export function DashboardHome({
  userKey,
  userLabel,
  conversations,
  onNewChat,
  onOpenProjects,
  onOpenMemory,
  onOpenHistory,
  onSelectMode,
  onOpenCommand,
}: {
  userKey: string;
  userLabel: string;
  conversations: Conversation[];
  onNewChat: () => void;
  onOpenProjects: () => void;
  onOpenMemory: () => void;
  onOpenHistory: () => void;
  onSelectMode: (mode: string) => void;
  onOpenCommand: () => void;
}) {
  const storageKey = "forgeai-projects-v1:" + (userKey || "local");
  const [projects, setProjects] = useState<ProjectPreview[]>(() => loadProjectPreviews(storageKey));

  useEffect(() => {
    setProjects(loadProjectPreviews(storageKey));
  }, [storageKey]);

  const recentConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 3),
    [conversations],
  );
  const activeProjects = projects.filter((project) => project.status === "In progress");
  const featuredProjects = [...projects].sort((a, b) => new Date(b.updatedAt || b.id).getTime() - new Date(a.updatedAt || a.id).getTime()).slice(0, 3);
  const completedTasks = projects.reduce((total, project) => total + (project.tasks || []).filter((task) => task.done).length, 0);
  const totalTasks = projects.reduce((total, project) => total + (project.tasks || []).length, 0);

  return (
    <section className="forge-dashboard">
      <div className="forge-dashboard-topline">
        <div className="forge-breadcrumb"><span className="forge-breadcrumb-dot" /> WORKSPACE <span>/</span> OVERVIEW</div>
        <button className="forge-command-trigger" onClick={onOpenCommand}><span>⌕</span> Search anything... <kbd>Ctrl K</kbd></button>
      </div>

      <div className="forge-dashboard-hero-grid">
        <div className="forge-hero-card">
          <div className="forge-hero-orbit forge-orbit-one" /><div className="forge-hero-orbit forge-orbit-two" /><div className="forge-hero-glow" />
          <div className="forge-hero-content">
            <div className="forge-hero-welcome">WELCOME BACK, <strong>{userLabel || "ENGINEER"}</strong> <span>✦</span></div>
            <div className="forge-hero-wordmark">Forge<span>AI</span><i>.</i></div>
            <h1>Your ideas deserve<br />exceptional engineering.</h1>
            <p>Think deeper. Build faster. Ship with confidence.</p>
            <div className="forge-hero-actions">
              <button className="forge-gradient-button" onClick={onNewChat}>Start a new chat <span>↗</span></button>
              <button className="forge-outline-button" onClick={onOpenProjects}>▦ Explore projects</button>
            </div>
          </div>
          <div className="forge-hero-emblem"><div className="forge-emblem-ring" /><span>F</span><small>BUILD WITHOUT LIMITS</small></div>
          <div className="forge-hero-footnote"><span>✦</span> YOUR AI ENGINEERING COMPANION</div>
        </div>

        <aside className="forge-status-card">
          <div className="forge-panel-heading"><div><span className="forge-section-kicker">SYSTEM OVERVIEW</span><h2>Workspace status</h2></div><span className="forge-live-pill"><i /> READY</span></div>
          <div className="forge-status-row"><span className="forge-status-icon">⌘</span><span><strong>AI workspace</strong><small>Engineering assistant</small></span><b>Available</b></div>
          <div className="forge-status-row"><span className="forge-status-icon blue">◈</span><span><strong>AI provider</strong><small>Groq integration</small></span><b>Configured</b></div>
          <div className="forge-status-row"><span className="forge-status-icon purple">▦</span><span><strong>Project library</strong><small>Saved workspaces</small></span><b>{projects.length} projects</b></div>
          <div className="forge-status-metrics"><div><strong>{conversations.length}</strong><span>CONVERSATIONS</span></div><div><strong>{completedTasks}<i>/{totalTasks}</i></strong><span>TASKS DONE</span></div></div>
          <div className="forge-status-foot"><span>✦</span> Ready when you are.</div>
        </aside>
      </div>

      <section className="forge-dashboard-section forge-modes-section">
        <div className="forge-section-heading"><div><span className="forge-section-kicker">PICK YOUR WORKFLOW</span><h2>Engineering modes<span>.</span></h2></div><button onClick={onOpenCommand}>Explore commands <span>↗</span></button></div>
        <div className="forge-mode-grid">
          {modeCards.map((item) => <button key={item.name} className={"forge-mode-card tone-" + item.tone} onClick={() => onSelectMode(item.name)}>
            <span className="forge-mode-icon">{item.icon}</span><strong>{item.name}</strong><small>{item.caption}</small><i>↗</i>
          </button>)}
        </div>
      </section>

      <div className="forge-dashboard-lower-grid">
        <section className="forge-dashboard-section forge-projects-section">
          <div className="forge-section-heading"><div><span className="forge-section-kicker">YOUR BUILDS</span><h2>Project workspaces <span className="forge-count">{projects.length}</span></h2></div><button onClick={onOpenProjects}>View all <span>↗</span></button></div>
          {featuredProjects.length ? <div className="forge-project-list">{featuredProjects.map((project) => {
            const tasks = project.tasks || [];
            const done = tasks.filter((task) => task.done).length;
            const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0;
            return <button className="forge-project-row" key={project.id} onClick={onOpenProjects}>
              <span className="forge-project-avatar">{project.name.slice(0, 1).toUpperCase()}</span>
              <span className="forge-project-info"><strong>{project.name}</strong><small>{project.description || project.stack || "Project workspace"}</small><span className="forge-project-progress"><i style={{ width: progress + "%" }} /></span></span>
              <span className={"forge-project-state " + (project.status === "In progress" ? "is-active" : "")}>{project.status || "Planning"}</span>
            </button>;
          })}</div> : <div className="forge-dashboard-empty"><span>▦</span><strong>Your next build starts here.</strong><small>Create a workspace to keep project context and tasks together.</small><button onClick={onOpenProjects}>Create a project ↗</button></div>}
          <div className="forge-project-footer"><span>{activeProjects.length} active builds</span><span>{completedTasks} of {totalTasks} tasks completed</span></div>
        </section>

        <div className="forge-side-stack">
          <section className="forge-dashboard-section forge-memory-card">
            <div className="forge-section-heading"><div><span className="forge-section-kicker">YOUR CONTEXT</span><h2>Memory vault</h2></div><button onClick={onOpenMemory}>Open <span>↗</span></button></div>
            <div className="forge-memory-visual"><div className="forge-memory-orb">✧</div><div><strong>Context that grows<br />with every session.</strong><small>Review and manage what ForgeAI remembers.</small></div></div>
            <button className="forge-memory-link" onClick={onOpenMemory}>Explore saved memories <span>→</span></button>
          </section>

          <section className="forge-dashboard-section forge-activity-card">
            <div className="forge-section-heading"><div><span className="forge-section-kicker">PICK UP WHERE YOU LEFT OFF</span><h2>Recent activity</h2></div><button onClick={onOpenHistory}>History <span>↗</span></button></div>
            {recentConversations.length ? <div className="forge-activity-list">{recentConversations.map((conversation) => <button key={conversation.id} onClick={onOpenHistory}><span className="forge-activity-icon">↗</span><span><strong>{conversation.title}</strong><small>{timeAgo(conversation.updated_at)}</small></span></button>)}</div> : <div className="forge-activity-empty">Your recent conversations will appear here.</div>}
          </section>
        </div>
      </div>
      <div className="forge-dashboard-bottomline"><span>FORGEAI <i>●</i> ENGINEERING INTELLIGENCE</span><span>BUILT TO TURN IDEAS INTO SOFTWARE.</span></div>
    </section>
  );
}
