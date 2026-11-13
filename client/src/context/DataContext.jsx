import { createContext, useContext, useEffect, useState } from "react";
import api, { errorMessage } from "../api/client";
import Loading from "../components/Loading";

const DataContext = createContext(null);

const COLORS = [
  "#4F46E5",
  "#14B8A6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#22C55E",
  "#0EA5E9",
  "#8B5CF6",
];

export function DataProvider({ children }) {
  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get("/subjects"),
      api.get("/tasks"),
      api.get("/timetable"),
      api.get("/notes"),
    ])
      .then(([s, t, tt, n]) => {
        if (cancelled) return;
        setSubjects(s.data);
        setTasks(t.data);
        setTimetable(tt.data);
        setNotes(n.data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function reload() {
    setLoadError("");
    setLoading(true);
    setAttempt((n) => n + 1);
  }

  /* ---------- subjects ---------- */

  async function addSubject({ name, type }) {
    const color = COLORS[subjects.length % COLORS.length];
    const res = await api.post("/subjects", { name, type, color });
    setSubjects((prev) => [...prev, res.data]);
    return res.data;
  }

  async function deleteSubject(id) {
    await api.delete(`/subjects/${id}`);
    setSubjects((prev) => prev.filter((s) => s._id !== id));
    setTasks((prev) => prev.filter((t) => t.subject !== id));
    setTimetable((prev) => prev.filter((e) => e.subject !== id));
    setNotes((prev) =>
      prev.map((n) =>
        n.subject === id ? { ...n, subject: null, task: null } : n,
      ),
    );
  }

  /* ---------- timetable ---------- */

  async function addClasses({ subject, days, start, end, room }) {
    const res = await api.post("/timetable", {
      subject,
      days,
      start,
      end,
      room,
    });
    setTimetable((prev) => [...prev, ...res.data]);
  }

  async function updateClass(id, changes) {
    const res = await api.put(`/timetable/${id}`, changes);
    setTimetable((prev) => prev.map((e) => (e._id === id ? res.data : e)));
    return res.data;
  }

  async function deleteClass(id) {
    await api.delete(`/timetable/${id}`);
    setTimetable((prev) => prev.filter((e) => e._id !== id));
  }

  /* ---------- tasks ---------- */

  async function addTask(data) {
    const res = await api.post("/tasks", data);
    setTasks((prev) => [res.data, ...prev]);
    return res.data;
  }

  async function updateTask(id, changes) {
    const res = await api.put(`/tasks/${id}`, changes);
    setTasks((prev) => prev.map((t) => (t._id === id ? res.data : t)));
    return res.data;
  }

  async function deleteTask(id) {
    await api.delete(`/tasks/${id}`);
    setTasks((prev) => prev.filter((t) => t._id !== id));
    setNotes((prev) =>
      prev.map((n) => (n.task === id ? { ...n, task: null } : n)),
    );
  }

  /* ---------- notes ---------- */

  async function createNote(data) {
    const res = await api.post("/notes", data);
    setNotes((prev) => [res.data, ...prev]);
    return res.data;
  }

  function changeNoteLocally(id, changes) {
    setNotes((prev) =>
      prev.map((n) =>
        n._id === id
          ? { ...n, ...changes, updatedAt: new Date().toISOString() }
          : n,
      ),
    );
  }

  async function saveNote(id, changes) {
    await api.put(`/notes/${id}`, changes);
  }

  async function deleteNote(id) {
    await api.delete(`/notes/${id}`);
    setNotes((prev) => prev.filter((n) => n._id !== id));
  }

  const value = {
    subjects,
    tasks,
    timetable,
    notes,
    loading,
    loadError,
    addSubject,
    deleteSubject,
    addClasses,
    updateClass,
    deleteClass,
    addTask,
    updateTask,
    deleteTask,
    createNote,
    changeNoteLocally,
    saveNote,
    deleteNote,
  };

  if (loading) return <Loading label="Loading your planner..." />;

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="mb-1 text-sm font-bold text-slate-900">
            Could not load your data
          </p>
          <p className="mb-4 text-sm text-red-600">{loadError}</p>
          <button
            onClick={reload}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  return useContext(DataContext);
}
