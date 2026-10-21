import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createMemory,
  deleteMemory,
  listMemories,
  updateMemory,
  type MemoryItem,
} from "./memory.api";

const emptyForm = { title: "", content: "", tags: "" };
const MAX_MEMORY_TAGS = 20;

export function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const parsedTags = form.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const tagLimitExceeded = parsedTags.length > MAX_MEMORY_TAGS;

  const refresh = useCallback(async (search = query) => {
    setLoading(true);
    setError(null);
    try {
      setMemories(await listMemories(search));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load memories.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(query); }, 220);
    return () => window.clearTimeout(timer);
  }, [query, refresh]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const beginEdit = (memory: MemoryItem) => {
    setForm({ title: memory.title, content: memory.content, tags: memory.tags.join(", ") });
    setEditingId(memory.id);
    setShowForm(true);
    setNotice(null);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const tags = form.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (tags.length > MAX_MEMORY_TAGS) {
      setError(`You can add up to ${MAX_MEMORY_TAGS} tags per memory. Remove ${tags.length - MAX_MEMORY_TAGS} tag${tags.length - MAX_MEMORY_TAGS === 1 ? "" : "s"} to continue.`);
      return;
    }
    setSaving(true);
    const input = {
      title: form.title.trim(),
      content: form.content.trim(),
      tags,
    };
    try {
      if (editingId) await updateMemory(editingId, input);
      else await createMemory(input);
      resetForm();
      setNotice(editingId ? "Memory updated." : "Memory saved.");
      await refresh(query);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this memory.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (memory: MemoryItem) => {
    if (!window.confirm('Delete the memory "' + memory.title + '"?')) return;
    setError(null);
    setNotice(null);
    try {
      await deleteMemory(memory.id);
      setMemories((current) => current.filter((item) => item.id !== memory.id));
      if (editingId === memory.id) resetForm();
      setNotice("Memory deleted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this memory.");
    }
  };

  return (
    <section className="memory-panel" aria-labelledby="memory-heading">
      <div className="memory-heading">
        <div>
          <span className="memory-eyebrow">PERSONAL KNOWLEDGE BASE</span>
          <h1 id="memory-heading">Memory <span>vault</span></h1>
          <p>Save the details you want ForgeAI to remember across conversations.</p>
        </div>
        <button className="memory-primary-button" onClick={() => { resetForm(); setShowForm(true); setNotice(null); setError(null); }}>
          <span>＋</span> New memory
        </button>
      </div>

      <div className="memory-search-row">
        <label className="memory-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved memories…" aria-label="Search saved memories" />
        </label>
        <span className="memory-count">{loading ? "Loading…" : memories.length + (memories.length === 1 ? " memory" : " memories")}</span>
      </div>

      {notice && <div className="memory-notice" role="status">{notice}</div>}
      {error && <div className="memory-error" role="alert">{error}</div>}

      {showForm && (
        <form className="memory-editor" onSubmit={(event) => void handleSubmit(event)}>
          <div className="memory-editor-heading">
            <div><span className="memory-eyebrow">{editingId ? "EDIT ENTRY" : "NEW ENTRY"}</span><h2>{editingId ? "Update memory" : "Save a memory"}</h2></div>
            <button className="memory-close-button" type="button" onClick={resetForm} aria-label="Close editor">×</button>
          </div>
          <label>Title<input required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. ForgeAI architecture" /></label>
          <label>Details<textarea required maxLength={12000} rows={4} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Write a useful preference, project detail, or technical decision…" /></label>
          <label>Tags <span className="memory-label-hint">comma-separated · up to {MAX_MEMORY_TAGS}</span><input value={form.tags} aria-describedby="memory-tag-help" aria-invalid={tagLimitExceeded} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="React, API, preferences" /><span id="memory-tag-help" className={tagLimitExceeded ? "memory-tag-limit memory-tag-limit-error" : "memory-tag-limit"} role={tagLimitExceeded ? "alert" : "status"}>{parsedTags.length}/{MAX_MEMORY_TAGS} tags{tagLimitExceeded ? ` — remove ${parsedTags.length - MAX_MEMORY_TAGS} to save.` : ""}</span></label>
          <div className="memory-form-actions">
            <button type="button" className="memory-secondary-button" onClick={resetForm}>Cancel</button>
            <button type="submit" className="memory-primary-button" disabled={saving || tagLimitExceeded}>{saving ? "Saving…" : editingId ? "Save changes" : "Save memory"}</button>
          </div>
        </form>
      )}

      <div className="memory-list">
        {loading ? (
          <div className="memory-empty"><span>◌</span><strong>Loading your memories</strong><p>Gathering your saved notes…</p></div>
        ) : memories.length === 0 ? (
          <div className="memory-empty"><span>◇</span><strong>{query ? "No memories found" : "Your memory vault is empty"}</strong><p>{query ? "Try another search term." : "Save project details, coding preferences, and decisions so relevant context can follow you into future chats."}</p>{!query && !showForm && <button className="memory-secondary-button" onClick={() => setShowForm(true)}>Create your first memory</button>}</div>
        ) : memories.map((memory) => (
          <article className="memory-card" key={memory.id}>
            <div className="memory-card-top">
              <div className="memory-card-icon">◇</div>
              <div className="memory-card-copy"><h2>{memory.title}</h2><span>Updated {new Date(memory.updated_at).toLocaleDateString()}</span></div>
              <div className="memory-card-actions">
                <button title="Edit memory" aria-label={"Edit " + memory.title} onClick={() => beginEdit(memory)}>Edit</button>
                <button title="Delete memory" aria-label={"Delete " + memory.title} onClick={() => void handleDelete(memory)}>×</button>
              </div>
            </div>
            <p className="memory-card-content">{memory.content}</p>
            {memory.tags.length > 0 && <div className="memory-tags">{memory.tags.map((tag, index) => <span key={tag + index}>{tag}</span>)}</div>}
          </article>
        ))}
      </div>
      <p className="memory-footnote">Memories are private to your account. ForgeAI uses matching saved notes as reference context when relevant.</p>
    </section>
  );
}
