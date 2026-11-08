import { useState, useRef, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { useData } from "../context/DataContext";
import { errorMessage } from "../api/client";

function renderInline(text) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}

function NotePreview({ content, onToggleLine }) {
  if (!content.trim()) {
    return <p className="text-sm text-slate-400">Nothing to preview yet.</p>;
  }
  return (
    <div className="space-y-1 text-sm text-slate-800">
      {content.split("\n").map((line, i) => {
        const check = line.match(/^- \[( |x)\] (.*)$/);
        if (check) {
          const done = check[1] === "x";
          return (
            <label key={i} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={done}
                onChange={() => onToggleLine(i)}
                className="mt-1 h-4 w-4"
              />
              <span className={done ? "text-slate-400 line-through" : ""}>
                {renderInline(check[2])}
              </span>
            </label>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h4 key={i} className="mt-2 text-base font-bold">
              {renderInline(line.slice(3))}
            </h4>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h3 key={i} className="mt-3 text-lg font-bold">
              {renderInline(line.slice(2))}
            </h3>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2">
              <span>•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

const SAVE_LABELS = {
  saved: "Saved",
  unsaved: "Unsaved changes...",
  saving: "Saving...",
  error: "Couldn't save. It will retry on your next change.",
};

function Notes() {
  const {
    notes,
    subjects,
    tasks,
    loading,
    loadError,
    createNote,
    changeNoteLocally,
    saveNote,
    deleteNote,
  } = useData();

  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [error, setError] = useState("");

  const textareaRef = useRef(null);
  const pending = useRef({});
  const timer = useRef(null);
  const queue = useRef(Promise.resolve());
  const saveRef = useRef(saveNote);

  useEffect(() => {
    saveRef.current = saveNote;
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const entries = Object.entries(pending.current);
    if (entries.length === 0) return queue.current;
    pending.current = {};
    setSaveState("saving");
    queue.current = queue.current.then(async () => {
      try {
        await Promise.all(
          entries.map(([id, changes]) => saveRef.current(id, changes)),
        );
        setSaveState(
          Object.keys(pending.current).length > 0 ? "unsaved" : "saved",
        );
      } catch {
        entries.forEach(([id, changes]) => {
          pending.current[id] = { ...changes, ...pending.current[id] };
        });
        setSaveState("error");
      }
    });
    return queue.current;
  }, []);

  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  useEffect(() => {
    function warn(e) {
      if (Object.keys(pending.current).length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function edit(id, changes, immediate = false) {
    changeNoteLocally(id, changes);
    pending.current[id] = { ...pending.current[id], ...changes };
    clearTimeout(timer.current);
    if (immediate) {
      flush();
    } else {
      setSaveState("unsaved");
      timer.current = setTimeout(flush, 800);
    }
  }

  async function handleCreate() {
    setError("");
    try {
      const note = await createNote({
        title: "",
        content: "",
        subject: filterSubject || null,
        task: null,
      });
      setSelectedId(note._id);
      setPreview(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete(note) {
    if (!window.confirm("Delete this note?")) return;
    delete pending.current[note._id];
    setError("");
    try {
      await queue.current;
      await deleteNote(note._id);
      setSelectedId(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  const selected = notes.find((n) => n._id === selectedId);

  function applyFormat(type) {
    const el = textareaRef.current;
    if (!el || !selected) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    let next;
    let cursorStart;
    let cursorEnd;

    if (type === "bold") {
      const chosen = value.slice(s, e) || "bold text";
      next = value.slice(0, s) + "**" + chosen + "**" + value.slice(e);
      cursorStart = s + 2;
      cursorEnd = s + 2 + chosen.length;
    } else {
      const prefixes = { h1: "# ", h2: "## ", bullet: "- ", check: "- [ ] " };
      const prefix = prefixes[type];
      const lineStart = s === 0 ? 0 : value.lastIndexOf("\n", s - 1) + 1;
      next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      cursorStart = e + prefix.length;
      cursorEnd = cursorStart;
    }

    edit(selected._id, { content: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function toggleCheckLine(index) {
    const lines = selected.content.split("\n");
    lines[index] = lines[index].startsWith("- [ ] ")
      ? lines[index].replace("- [ ] ", "- [x] ")
      : lines[index].replace("- [x] ", "- [ ] ");
    edit(selected._id, { content: lines.join("\n") });
  }

  const query = search.trim().toLowerCase();
  const visibleNotes = notes
    .filter((n) => !filterSubject || n.subject === filterSubject)
    .filter(
      (n) =>
        !query ||
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query),
    )
    .sort(
      (a, b) =>
        Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );

  const taskOptions = selected
    ? tasks.filter(
        (t) =>
          t._id === selected.task ||
          (!t.completed &&
            (!selected.subject || t.subject === selected.subject)),
      )
    : [];

  const wordCount =
    selected && selected.content.trim()
      ? selected.content.trim().split(/\s+/).length
      : 0;

  const inputClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";
  const toolButton =
    "rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notes</h2>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New note
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="md:flex md:gap-4">
        <aside
          className={`${selected ? "hidden" : "block"} md:block md:w-72 md:shrink-0`}
        >
          <div className="mb-3 flex flex-col gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className={inputClass}
            />
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className={inputClass}
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {notes.length === 0 ? (
            <p className="text-sm text-slate-500">
              No notes yet. Click "New note" to start.
            </p>
          ) : visibleNotes.length === 0 ? (
            <p className="text-sm text-slate-500">No notes match.</p>
          ) : (
            <ul className="flex flex-col gap-2 md:max-h-[70vh] md:overflow-y-auto">
              {visibleNotes.map((note) => {
                const subject = subjects.find((s) => s._id === note.subject);
                return (
                  <li key={note._id}>
                    <button
                      onClick={() => {
                        setSelectedId(note._id);
                        setPreview(false);
                      }}
                      className={`w-full rounded-lg border p-3 text-left ${
                        note._id === selectedId
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold">
                          {note.title || "Untitled note"}
                        </p>
                        {note.pinned && (
                          <span className="text-xs text-indigo-600">
                            Pinned
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {note.content.replace(/\s+/g, " ").slice(0, 70) ||
                          "No content"}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: subject
                              ? subject.color
                              : "#94A3B8",
                          }}
                        />
                        <span>{subject ? subject.name : "General"}</span>
                        <span>
                          · {format(parseISO(note.updatedAt), "d MMM")}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section
          className={`${selected ? "block" : "hidden"} min-w-0 flex-1 md:block`}
        >
          {!selected ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
              Select a note, or create a new one.
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-sm text-indigo-600 md:hidden"
                >
                  ← All notes
                </button>
                <div className="ml-auto flex gap-3 text-sm">
                  <button
                    onClick={() =>
                      edit(selected._id, { pinned: !selected.pinned }, true)
                    }
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    {selected.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    onClick={() => handleDelete(selected)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <input
                value={selected.title}
                onChange={(e) => edit(selected._id, { title: e.target.value })}
                placeholder="Title"
                className="mb-3 w-full border-b border-slate-200 pb-2 text-xl font-bold outline-none focus:border-indigo-500"
              />

              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <select
                  value={selected.subject ?? ""}
                  onChange={(e) =>
                    edit(
                      selected._id,
                      { subject: e.target.value || null, task: null },
                      true,
                    )
                  }
                  className={inputClass}
                >
                  <option value="">General (no subject)</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selected.task ?? ""}
                  onChange={(e) =>
                    edit(selected._id, { task: e.target.value || null }, true)
                  }
                  className={inputClass}
                >
                  <option value="">No linked task</option>
                  {taskOptions.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {!preview && (
                  <>
                    <button
                      onClick={() => applyFormat("h1")}
                      className={toolButton}
                    >
                      H1
                    </button>
                    <button
                      onClick={() => applyFormat("h2")}
                      className={toolButton}
                    >
                      H2
                    </button>
                    <button
                      onClick={() => applyFormat("bold")}
                      className={`${toolButton} font-bold`}
                    >
                      B
                    </button>
                    <button
                      onClick={() => applyFormat("bullet")}
                      className={toolButton}
                    >
                      • List
                    </button>
                    <button
                      onClick={() => applyFormat("check")}
                      className={toolButton}
                    >
                      ☐ Checklist
                    </button>
                  </>
                )}
                <button
                  onClick={() => setPreview(!preview)}
                  className={`${toolButton} ml-auto ${preview ? "border-indigo-500 text-indigo-600" : ""}`}
                >
                  {preview ? "Back to editing" : "Preview"}
                </button>
              </div>

              {preview ? (
                <div className="min-h-[50vh]">
                  <NotePreview
                    content={selected.content}
                    onToggleLine={toggleCheckLine}
                  />
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={selected.content}
                  onChange={(e) =>
                    edit(selected._id, { content: e.target.value })
                  }
                  placeholder="Start writing... Use the toolbar for headings, lists and checklists."
                  className="min-h-[50vh] w-full resize-y rounded-lg border border-slate-200 p-3 text-sm leading-relaxed outline-none focus:border-indigo-500"
                />
              )}

              <p className="mt-2 text-xs text-slate-400">
                {wordCount} word{wordCount === 1 ? "" : "s"} ·{" "}
                <span className={saveState === "error" ? "text-red-500" : ""}>
                  {SAVE_LABELS[saveState]}
                </span>{" "}
                · Last edited{" "}
                {format(parseISO(selected.updatedAt), "d MMM, h:mm a")}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Notes;
