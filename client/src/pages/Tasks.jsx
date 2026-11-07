import { useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import useLocalStorage from "../hooks/useLocalStorage";

const CATEGORIES_BY_TYPE = {
  theory: ["Assignment", "Tutorial", "Homework"],
  practical: ["Practical", "Assignment"],
};
const ALL_CATEGORIES = ["Assignment", "Tutorial", "Homework", "Practical"];

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
  const [tasks, setTasks] = useLocalStorage("studymate-tasks-v2", []);
  const [subjects] = useLocalStorage("studymate-subjects", []);

  const [subjectId, setSubjectId] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [editingId, setEditingId] = useState(null);

  const [filterSubject, setFilterSubject] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showCompleted, setShowCompleted] = useState(true);

  const selectedSubject = subjects.find((s) => String(s.id) === subjectId);
  const categoryOptions = selectedSubject
    ? CATEGORIES_BY_TYPE[selectedSubject.type]
    : [];

  function handleSubjectChange(e) {
    const id = e.target.value;
    setSubjectId(id);
    const subject = subjects.find((s) => String(s.id) === id);
    setCategory(subject ? CATEGORIES_BY_TYPE[subject.type][0] : "");
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDueDate("");
    setPriority("Medium");
  }

  function startEdit(task) {
    setEditingId(task.id);
    setSubjectId(String(task.subjectId));
    setCategory(task.category);
    setTitle(task.title);
    setDueDate(task.dueDate);
    setPriority(task.priority);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addTask(e) {
    e.preventDefault();
    if (!subjectId || !title.trim()) return;

    if (editingId) {
      setTasks(
        tasks.map((t) =>
          t.id === editingId
            ? {
                ...t,
                title: title.trim(),
                subjectId: Number(subjectId),
                category,
                dueDate,
                priority,
              }
            : t,
        ),
      );
    } else {
      setTasks([
        {
          id: Date.now(),
          title: title.trim(),
          subjectId: Number(subjectId),
          category,
          dueDate,
          priority,
          completed: false,
        },
        ...tasks,
      ]);
    }
    resetForm();
  }

  function toggleTask(id) {
    setTasks(
      tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
    if (editingId === id) resetForm();
  }

  function deleteTask(id) {
    setTasks(tasks.filter((t) => t.id !== id));
    if (editingId === id) resetForm();
  }

  const visibleTasks = tasks
    .filter((t) => !filterSubject || String(t.subjectId) === filterSubject)
    .filter((t) => !filterCategory || t.category === filterCategory)
    .filter((t) => showCompleted || !t.completed)
    .sort((a, b) => getScore(b) - getScore(a));

  const grouped = GROUP_ORDER.map((name) => ({
    name,
    items: visibleTasks.filter((t) => getGroup(t) === name),
  })).filter((g) => g.items.length > 0);

  const inputClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";

  function renderTask(task) {
    const subject = subjects.find((s) => s.id === task.subjectId);
    const due = dueLabel(task);
    return (
      <li
        key={task.id}
        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
      >
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => toggleTask(task.id)}
          className="h-4 w-4"
        />
        <div className="flex-1">
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
          </div>
        </div>
        <div className="flex gap-3">
          {!task.completed && (
            <button
              onClick={() => startEdit(task)}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => deleteTask(task.id)}
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

      {subjects.length === 0 ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Add your classes in the timetable first so tasks can be linked to
          subjects.{" "}
          <Link to="/timetable" className="font-medium underline">
            Go to Timetable
          </Link>
        </div>
      ) : (
        <form onSubmit={addTask} className="mb-6 grid gap-2 sm:grid-cols-2">
          <select
            value={subjectId}
            onChange={handleSubjectChange}
            className={inputClass}
          >
            <option value="">Select subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.type})
              </option>
            ))}
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

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
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

          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {editingId ? "Save changes" : "Add task"}
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
      )}

      {tasks.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
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
            Show completed
          </label>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500">No tasks yet.</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-slate-500">No tasks match these filters.</p>
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
