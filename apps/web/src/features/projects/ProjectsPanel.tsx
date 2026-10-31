import React, { useEffect, useMemo, useState } from "react";

type ProjectStatus = "Planning" | "In progress" | "Paused" | "Completed";
type ProjectTask = { id: string; title: string; done: boolean };
type Project = {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string;
  stack: string;
  status: ProjectStatus;
  notes: string;
  tasks: ProjectTask[];
  createdAt: string;
  updatedAt: string;
};

const statuses: ProjectStatus[] = ["Planning", "In progress", "Paused", "Completed"];
const makeId = () => globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(16).slice(2);

function readProjects(key: string): Project[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Project =>
      item && typeof item.id === "string" && typeof item.name === "string" &&
      Array.isArray(item.tasks) && typeof item.notes === "string"
    );
  } catch {
    return [];
  }
}

function validRepositoryUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "github.com" || url.hostname === "www.github.com");
  } catch {
    return false;
  }
}

export function ProjectsPanel({
  userKey,
  onStartChat,
}: {
  userKey: string;
  onStartChat: (prompt: string) => void;
}) {
  const storageKey = "forgeai-projects-v1:" + (userKey || "local");
  const [projects, setProjects] = useState<Project[]>(() => readProjects(storageKey));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ProjectStatus>("All");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "", repositoryUrl: "", stack: "" });
  const [taskDraft, setTaskDraft] = useState("");

  useEffect(() => {
    setProjects(readProjects(storageKey));
    setSelectedId(null);
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(projects));
  }, [projects, storageKey]);

  const selected = projects.find((project) => project.id === selectedId) ?? null;
  const filtered = useMemo(() => projects.filter((project) => {
    const matchesQuery = (project.name + " " + project.description + " " + project.stack)
      .toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (statusFilter === "All" || project.status === statusFilter);
  }), [projects, query, statusFilter]);

  const updateProject = (id: string, patch: Partial<Project>) => {
    setProjects((current) => current.map((project) => project.id === id
      ? { ...project, ...patch, updatedAt: new Date().toISOString() }
      : project));
  };

  const createProject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name || !validRepositoryUrl(draft.repositoryUrl)) return;
    const now = new Date().toISOString();
    const project: Project = {
      id: makeId(),
      name,
      description: draft.description.trim(),
      repositoryUrl: draft.repositoryUrl.trim(),
      stack: draft.stack.trim(),
      status: "Planning",
      notes: "",
      tasks: [],
      createdAt: now,
      updatedAt: now,
    };
    setProjects((current) => [project, ...current]);
    setSelectedId(project.id);
    setDraft({ name: "", description: "", repositoryUrl: "", stack: "" });
    setCreating(false);
  };

  const addTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !taskDraft.trim()) return;
    updateProject(selected.id, { tasks: [...selected.tasks, { id: makeId(), title: taskDraft.trim(), done: false }] });
    setTaskDraft("");
  };

  const removeProject = (project: Project) => {
    if (!window.confirm('Delete "' + project.name + '" from this workspace?')) return;
    setProjects((current) => current.filter((item) => item.id !== project.id));
    setSelectedId(null);
  };

  const completedTasks = projects.reduce((sum, project) => sum + project.tasks.filter((task) => task.done).length, 0);
  const totalTasks = projects.reduce((sum, project) => sum + project.tasks.length, 0);
  const inProgress = projects.filter((project) => project.status === "In progress").length;

  if (selected) {
    const done = selected.tasks.filter((task) => task.done).length;
    const progress = selected.tasks.length ? Math.round(done / selected.tasks.length * 100) : 0;
    return (
      <section className="projects-panel">
        <div className="projects-detail-top">
          <button className="projects-back-button" onClick={() => setSelectedId(null)}>← All projects</button>
          <span className={"projects-status-badge status-" + selected.status.toLowerCase().replace(" ", "-")}>{selected.status}</span>
        </div>
        <div className="projects-detail-heading">
          <div className="projects-project-mark">{selected.name.slice(0, 1).toUpperCase()}</div>
          <div className="projects-detail-title">
            <span className="projects-eyebrow">PROJECT WORKSPACE</span>
            <h1>{selected.name}</h1>
            <p>{selected.description || "No project description yet. Add one from your project overview."}</p>
          </div>
          <button className="projects-danger-button" onClick={() => removeProject(selected)} title="Delete project">Delete</button>
        </div>
        <div className="projects-detail-actions">
          <button className="projects-primary-button" onClick={() => onStartChat(
            "Help me work on the project " + selected.name + ".\nDescription: " + (selected.description || "Not provided") +
            "\nTech stack: " + (selected.stack || "Not specified") +
            "\nGitHub repository: " + (selected.repositoryUrl || "Not connected") +
            "\nProject notes: " + (selected.notes || "None yet") +
            "\nTasks: " + (selected.tasks.map((task) => (task.done ? "[x] " : "[ ] ") + task.title).join("; ") || "None") +
            "\nPlease first understand this project context and help me choose the next best engineering step."
          )}>✦ Work with ForgeAI</button>
          {selected.repositoryUrl && <a className="projects-secondary-button" href={selected.repositoryUrl} target="_blank" rel="noreferrer">↗ Open repository</a>}
          <label className="projects-status-control">Status
            <select value={selected.status} onChange={(event) => updateProject(selected.id, { status: event.target.value as ProjectStatus })}>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>
        <div className="projects-detail-grid">
          <div className="projects-card projects-context-card">
            <div className="projects-card-heading"><div><span className="projects-eyebrow">PROJECT KNOWLEDGE</span><h2>Context & decisions</h2></div><span className="projects-card-icon">⌘</span></div>
            <p className="projects-card-description">Keep architecture notes, constraints, and decisions together. This context is saved in this browser and can be sent to ForgeAI when you start a project chat.</p>
            <textarea value={selected.notes} onChange={(event) => updateProject(selected.id, { notes: event.target.value })} placeholder="Architecture, goals, key files, decisions, APIs, constraints..." rows={9} />
            <div className="projects-field-hint">Saved automatically · Private to this signed-in browser profile</div>
          </div>
          <div className="projects-card projects-task-card">
            <div className="projects-card-heading"><div><span className="projects-eyebrow">EXECUTION PLAN</span><h2>Project tasks</h2></div><span className="projects-task-count">{done}/{selected.tasks.length}</span></div>
            <div className="projects-progress-track"><span style={{ width: progress + "%" }} /></div>
            <div className="projects-progress-caption"><span>{progress}% complete</span><span>{selected.tasks.length - done} remaining</span></div>
            <form className="projects-task-form" onSubmit={addTask}>
              <input value={taskDraft} onChange={(event) => setTaskDraft(event.target.value)} placeholder="Add a task..." aria-label="New project task" maxLength={140} />
              <button type="submit" disabled={!taskDraft.trim()}>＋</button>
            </form>
            <div className="projects-task-list">
              {selected.tasks.length ? selected.tasks.map((task) => (
                <div className={task.done ? "projects-task-row is-done" : "projects-task-row"} key={task.id}>
                  <label><input type="checkbox" checked={task.done} onChange={(event) => updateProject(selected.id, { tasks: selected.tasks.map((item) => item.id === task.id ? { ...item, done: event.target.checked } : item) })} /><span>{task.title}</span></label>
                  <button title="Remove task" aria-label={"Remove " + task.title} onClick={() => updateProject(selected.id, { tasks: selected.tasks.filter((item) => item.id !== task.id) })}>×</button>
                </div>
              )) : <div className="projects-task-empty">Your execution plan starts here. Add the first task above.</div>}
            </div>
          </div>
        </div>
        <div className="projects-detail-footer">
          <span>CREATED {new Date(selected.createdAt).toLocaleDateString()}</span>
          <span>UPDATED {new Date(selected.updatedAt).toLocaleDateString()}</span>
          <span>{selected.stack || "STACK NOT SET"}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="projects-panel">
      <div className="projects-page-heading">
        <div>
          <span className="projects-eyebrow">YOUR ENGINEERING HQ</span>
          <h1>Project workspaces<span>.</span></h1>
          <p>Organize your builds, capture technical context, and turn ideas into shipped work.</p>
        </div>
        <button className="projects-primary-button" onClick={() => setCreating((value) => !value)}>＋ New project</button>
      </div>
      <div className="projects-stats-grid">
        <div className="projects-stat-card"><span>ACTIVE BUILDS</span><strong>{inProgress.toString().padStart(2, "0")}</strong><small>Projects in progress</small></div>
        <div className="projects-stat-card"><span>ALL PROJECTS</span><strong>{projects.length.toString().padStart(2, "0")}</strong><small>Your workspace library</small></div>
        <div className="projects-stat-card"><span>TASKS COMPLETED</span><strong>{completedTasks.toString().padStart(2, "0")}<i> / {totalTasks}</i></strong><small>Across all projects</small></div>
      </div>
      {creating && (
        <form className="projects-create-card" onSubmit={createProject}>
          <div className="projects-card-heading"><div><span className="projects-eyebrow">NEW WORKSPACE</span><h2>Start something great</h2></div><button type="button" className="projects-close-button" onClick={() => setCreating(false)}>×</button></div>
          <div className="projects-form-grid">
            <label>Project name<input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Nova AI Desktop" maxLength={70} required /></label>
            <label>Tech stack<input value={draft.stack} onChange={(event) => setDraft({ ...draft, stack: event.target.value })} placeholder="React · FastAPI · Supabase" maxLength={120} /></label>
            <label className="projects-form-wide">Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What are you building? What problem does it solve?" rows={2} maxLength={500} /></label>
            <label className="projects-form-wide">GitHub repository URL <span className="projects-optional">OPTIONAL</span><input value={draft.repositoryUrl} onChange={(event) => setDraft({ ...draft, repositoryUrl: event.target.value })} placeholder="https://github.com/owner/repository" /></label>
          </div>
          {draft.repositoryUrl && !validRepositoryUrl(draft.repositoryUrl) && <p className="projects-validation-error">Enter a valid HTTPS GitHub repository URL.</p>}
          <div className="projects-form-actions"><span>Projects are currently saved in this browser.</span><button className="projects-primary-button" type="submit" disabled={!draft.name.trim() || !validRepositoryUrl(draft.repositoryUrl)}>Create workspace →</button></div>
        </form>
      )}
      <div className="projects-list-toolbar">
        <div><span className="projects-eyebrow">WORKSPACE LIBRARY</span><h2>Your projects <span>{projects.length}</span></h2></div>
        <div className="projects-filters">
          <label className="projects-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a project..." /></label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | ProjectStatus)} aria-label="Filter projects by status"><option>All</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
        </div>
      </div>
      {filtered.length ? (
        <div className="projects-grid">
          {filtered.map((project) => {
            const finished = project.tasks.filter((task) => task.done).length;
            const percent = project.tasks.length ? Math.round(finished / project.tasks.length * 100) : 0;
            return (
              <button className="projects-project-card" key={project.id} onClick={() => setSelectedId(project.id)}>
                <div className="projects-project-card-top"><span className="projects-project-mark">{project.name.slice(0, 1).toUpperCase()}</span><span className={"projects-status-badge status-" + project.status.toLowerCase().replace(" ", "-")}>{project.status}</span></div>
                <h3>{project.name}</h3>
                <p>{project.description || "A new idea, ready to take shape."}</p>
                <div className="projects-project-meta"><span>{project.stack || "STACK NOT SET"}</span><span>{project.tasks.length} TASKS</span></div>
                <div className="projects-progress-track"><span style={{ width: percent + "%" }} /></div>
                <div className="projects-project-bottom"><span>{finished}/{project.tasks.length} tasks complete</span><span>Open workspace ↗</span></div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="projects-empty-state">
          <div className="projects-empty-orbit">⌘</div>
          <h2>{projects.length ? "No matching projects" : "Your next big build starts here."}</h2>
          <p>{projects.length ? "Try another search or status filter." : "Create a workspace to organize project context, technical decisions, and execution tasks in one place."}</p>
          {!projects.length && <button className="projects-primary-button" onClick={() => setCreating(true)}>＋ Create your first project</button>}
        </div>
      )}
      <div className="projects-storage-note"><span>◈</span> Workspace data is saved locally in this browser. Repository URLs are references only; live GitHub sync is a future phase.</div>
    </section>
  );
}
