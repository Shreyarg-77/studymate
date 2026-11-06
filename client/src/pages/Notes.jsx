import { useState } from "react";
import { format, parseISO } from "date-fns";
import useLocalStorage from "../hooks/useLocalStorage";

function Notes() {
  const [notes, setNotes] = useLocalStorage("studymate-notes", []);
  const [subjects] = useLocalStorage("studymate-subjects", []);
  const [tasks] = useLocalStorage("studymate-tasks-v2", []);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  const taskOptions = tasks.filter(
    (t) => !t.completed && (!subjectId || String(t.subjectId) === subjectId),
  );

  function handleSubjectChange(e) {
    setSubjectId(e.target.value);
    setTaskId("");
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setSubjectId("");
    setTaskId("");
  }

  function saveNote(e) {
    e.preventDefault();
    if (!title.trim() && !content.trim()) return;

    const now = new Date().toISOString();
    const data = {
      title: title.trim() || "Untitled note",
      content: content.trim(),
      subjectId: subjectId ? Number(subjectId) : null,
      taskId: taskId ? Number(taskId) : null,
    };

    if (editingId) {
      setNotes(
        notes.map((n) =>
          n.id === editingId ? { ...n, ...data, updatedAt: now } : n,
        ),
      );
    } else {
      setNotes([{ id: Date.now(), ...data, updatedAt: now }, ...notes]);
    }
    resetForm();
  }

  function startEdit(note) {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setSubjectId(note.subjectId ? String(note.subjectId) : "");
    setTaskId(note.taskId ? String(note.taskId) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteNote(id) {
    if (!window.confirm("Delete this note?")) return;
    setNotes(notes.filter((n) => n.id !== id));
    if (editingId === id) resetForm();
  }

  const query = search.trim().toLowerCase();
  const visibleNotes = notes
    .filter((n) => !filterSubject || String(n.subjectId) === filterSubject)
    .filter(
      (n) =>
        !query ||
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const inputClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-2xl font-bold">Notes</h2>

      <form
        onSubmit={saveNote}
        className="mb-6 grid gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className={`${inputClass} sm:col-span-2`}
        />

        <select
          value={subjectId}
          onChange={handleSubjectChange}
          className={inputClass}
        >
          <option value="">General (no subject)</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className={inputClass}
        >
          <option value="">No linked task</option>
          {taskOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your note here..."
          rows={6}
          className={`${inputClass} sm:col-span-2`}
        />

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {editingId ? "Save changes" : "Add note"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {notes.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className={`${inputClass} flex-1`}
          />
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className={inputClass}
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-slate-500">
          No notes yet. Write your first one above.
        </p>
      ) : visibleNotes.length === 0 ? (
        <p className="text-sm text-slate-500">No notes match your search.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleNotes.map((note) => {
            const subject = subjects.find((s) => s.id === note.subjectId);
            const linkedTask = tasks.find((t) => t.id === note.taskId);
            return (
              <article
                key={note.id}
                className="flex flex-col rounded-lg border border-slate-200 bg-white p-4"
              >
                <h3 className="mb-1 font-bold">{note.title}</h3>

                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: subject ? subject.color : "#94A3B8",
                      }}
                    />
                    {subject ? subject.name : "General"}
                  </span>
                  {linkedTask && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">
                      Task: {linkedTask.title}
                    </span>
                  )}
                </div>

                <p className="mb-3 flex-1 whitespace-pre-wrap text-sm text-slate-700">
                  {note.content}
                </p>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {format(parseISO(note.updatedAt), "d MMM, h:mm a")}
                  </span>
                  <div className="flex gap-3">
                    <button
                      onClick={() => startEdit(note)}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Notes;
