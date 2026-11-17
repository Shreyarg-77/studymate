import { useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { useData } from "../context/DataContext";
import { errorMessage } from "../api/client";

const CATEGORIES_BY_TYPE = {
  theory: ["Assignment", "Tutorial", "Homework", "Revision"],
  practical: ["Practical", "Assignment", "Revision"],
  personal: ["Project", "Practice", "Revision", "Reading", "Other"],
};
const categoriesFor = (subject) =>
  (subject && CATEGORIES_BY_TYPE[subject.type]) || CATEGORIES_BY_TYPE.theory;

const ALL_CATEGORIES = [
  "Assignment",
  "Tutorial",
  "Homework",
  "Practical",
  "Revision",
  "Project",
  "Practice",
  "Reading",
  "Other",
];

const PERSONAL_SUGGESTIONS = [
  "Personal project",
  "Aptitude practice",
  "Coding practice",
  "Exam preparation",
  "Reading",
];

const PRIORITY_STYLES = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-green-100 text-green-700",
};
const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 };
const GROUP_ORDER = [
  "Overdue",
  "Today",
  "Upcoming",
  "No due date",
  "Completed",
];
const ESTIMATE_PRESETS = [30, 60, 90, 120];
const NEW_SUBJECT = "__new__";

function daysLeft(task) {
  return differenceInCalendarDays(parseISO(task.dueDate), new Date());
}

function getScore(task) {
  const base = PRIORITY_WEIGHT[task.priority] * 10;
  if (!task.dueDate) return base;
  const d = daysLeft(task);
  if (d < 0) return base + 25;
  return base + 10 / Math.max(d, 0.5);
}

function getGroup(task) {
  if (task.completed) return "Completed";
  if (!task.dueDate) return "No due date";
  const d = daysLeft(task);
  if (d < 0) return "Overdue";
  if (d === 0) return "Today";
  return "Upcoming";
}

function dueLabel(task) {
  if (!task.dueDate) return null;
  const d = daysLeft(task);
  if (d < 0)
    return {
      text: `Overdue by ${Math.abs(d)} day${Math.abs(d) > 1 ? "s" : ""}`,
      style: "text-red-600 font-medium",
    };
  if (d === 0)
    return { text: "Due today", style: "text-amber-600 font-medium" };
  if (d === 1) return { text: "Due tomorrow", style: "text-slate-600" };
  return {
    text: `Due ${format(parseISO(task.dueDate), "d MMM")}`,
    style: "text-slate-500",
  };
}

function Tasks() {
  const {
    tasks,
    subjects,
    loading,
    loadError,
    addTask,
    updateTask,
    deleteTask,
    addSubject,
  } = useData();

  const [subjectId, setSubjectId] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [estimate, setEstimate] = useState("60");
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [addingPersonal, setAddingPersonal] = useState(false);
  const [personalName, setPersonalName] = useState("");
  const [personalBusy, setPersonalBusy] = useState(false);

  const [filterSubject, setFilterSubject] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const classSubjects = subjects.filter((s) => s.type !== "personal");
  const personalSubjects = subjects.filter((s) => s.type === "personal");

  const selectedSubject = subjects.find((s) => s._id === subjectId);
  const categoryOptions = selectedSubject ? categoriesFor(selectedSubject) : [];

  function handleSubjectChange(e) {
    const id = e.target.value;
    if (id === NEW_SUBJECT) {
      setAddingPersonal(true);
      setSubjectId("");
      setCategory("");
      return;
    }
    setAddingPersonal(false);
    setSubjectId(id);
    const subject = subjects.find((s) => s._id === id);
    setCategory(subject ? categoriesFor(subject)[0] : "");
  }

  async function createPersonal(rawName) {
    const clean = rawName.trim();
    if (!clean) {
      setError("Enter a name for the personal subject.");
      return;
    }
    setError("");
    setPersonalBusy(true);
    try {
      const existing = subjects.find(
        (s) => s.name.toLowerCase() === clean.toLowerCase(),
      );
      const subject =
        existing || (await addSubject({ name: clean, type: "personal" }));
      setSubjectId(subject._id);
      setCategory(categoriesFor(subject)[0]);
      setAddingPersonal(false);
      setPersonalName("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPersonalBusy(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDueDate("");
    setPriority("Medium");
    setEstimate("60");
  }

  function startEdit(task) {
    setEditingId(task._id);
    setAddingPersonal(false);
    setSubjectId(task.subject);
    setCategory(task.category);
    setTitle(task.title);
    setDueDate(task.dueDate);
    setPriority(task.priority);
    setEstimate(String(task.estimatedMins ?? 60));
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!subjectId || !title.trim()) {
      setError("Choose a subject and enter a title.");
      return;
    }
    const mins = Number(estimate);
    if (!Number.isInteger(mins) || mins < 5 || mins > 600) {
      setError("Estimated time must be a whole number from 5 to 600 minutes.");
      return;
    }
    const data = {
      title: title.trim(),
      subject: subjectId,
      category: category || categoriesFor(selectedSubject)[0],
      dueDate,
      priority,
      estimatedMins: mins,
    };
    setSaving(true);
    setError("");
    try {
      if (editingId) await updateTask(editingId, data);
      else await addTask(data);
      resetForm();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task) {
    setError("");
    try {
      await updateTask(task._id, { completed: !task.completed });
      if (editingId === task._id) resetForm();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setError("");
    try {
      await deleteTask(task._id);
      if (editingId === task._id) resetForm();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  const visibleTasks = tasks
    .filter((t) => !filterSubject || t.subject === filterSubject)
    .filter((t) => !filterCategory || t.category === filterCategory)
    .filter((t) => showCompleted || !t.completed)
    .sort((a, b) => getScore(b) - getScore(a));

  const grouped = GROUP_ORDER.map((name) => ({
    name,
    items: visibleTasks.filter((t) => getGroup(t) === name),
  })).filter((g) => g.items.length > 0);

  const completedCount = tasks.filter((t) => t.completed).length;
  const pendingCount = tasks.length - completedCount;

  const inputClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";

  function renderTask(task) {
    const subject = subjects.find((s) => s._id === task.subject);
    const due = dueLabel(task);
    return (
      <li
        key={task._id}
        className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-white p-3"
      >
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => toggleTask(task)}
          className="mt-1 h-4 w-4"
        />
        <div className="min-w-[10rem] flex-1">
          <p
            className={
              task.completed ? "text-slate-400 line-through" : "font-medium"
            }
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: subject ? subject.color : "#94A3B8" }}
              />
              {subject ? subject.name : "Unknown subject"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5">
              {task.category}
            </span>
            {due && <span className={due.style}>{due.text}</span>}
            <span
              className={`rounded-full px-2 py-0.5 ${PRIORITY_STYLES[task.priority]}`}
            >
              {task.priority}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5">
              {task.estimatedMins ?? 60} min
            </span>
          </div>
        </div>
        <div className="flex w-full justify-end gap-4 sm:w-auto">
          {!task.completed && (
            <button
              onClick={() => startEdit(task)}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => handleDelete(task)}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-4 text-2xl font-bold">Tasks</h2>

      {subjects.length === 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Add your classes in the{" "}
          <Link to="/timetable" className="font-medium underline">
            Timetable
          </Link>{" "}
          to get class subjects, or add a personal subject below for projects
          and self-study.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <select
          value={addingPersonal ? NEW_SUBJECT : subjectId}
          onChange={handleSubjectChange}
          className={inputClass}
        >
          <option value="">Select subject</option>
          {classSubjects.length > 0 && (
            <optgroup label="Class subjects">
              {classSubjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.type})
                </option>
              ))}
            </optgroup>
          )}
          {personalSubjects.length > 0 && (
            <optgroup label="Personal / self-study">
              {personalSubjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )}
          <option value={NEW_SUBJECT}>+ Add a personal subject...</option>
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={!selectedSubject}
          className={inputClass}
        >
          {!selectedSubject && <option value="">Category</option>}
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {addingPersonal && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 sm:col-span-2">
            <p className="mb-2 text-xs font-medium text-indigo-900">
              New personal subject. It is for projects, practice and other
              self-study, and never appears in your timetable.
            </p>
            <div className="mb-2 flex flex-wrap gap-2">
              {PERSONAL_SUGGESTIONS.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => createPersonal(suggestion)}
                  disabled={personalBusy}
                  className="rounded-full border border-indigo-300 bg-white px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={personalName}
                onChange={(e) => setPersonalName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createPersonal(personalName);
                  }
                }}
                placeholder="Or type your own, e.g. Hackathon app"
                maxLength={40}
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => createPersonal(personalName)}
                disabled={personalBusy}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAddingPersonal(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          maxLength={120}
          className={`${inputClass} sm:col-span-2`}
        />

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputClass}
        />

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={inputClass}
        >
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Estimated time (minutes)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min="5"
              max="600"
              step="5"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              className={`${inputClass} w-28`}
            />
            {ESTIMATE_PRESETS.map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setEstimate(String(n))}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  estimate === String(n)
                    ? "border-indigo-600 bg-indigo-50 text-indigo-600"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add task"}
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

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {tasks.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
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

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={inputClass}
          >
            <option value="">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            Show completed ({completedCount})
          </label>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500">No tasks yet.</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-slate-500">
          {!showCompleted && completedCount > 0 && pendingCount === 0
            ? "Everything is done. Tick Show completed to see finished tasks."
            : "No tasks match these filters."}
        </p>
      ) : (
        grouped.map((group) => (
          <section key={group.name} className="mb-5">
            <h3 className="mb-2 text-sm font-bold text-slate-700">
              {group.name}{" "}
              <span className="font-normal text-slate-400">
                ({group.items.length})
              </span>
            </h3>
            <ul className="flex flex-col gap-2">
              {group.items.map(renderTask)}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

export default Tasks;
