import { useState } from "react";
import { useData } from "../context/DataContext";
import { errorMessage } from "../api/client";

function Subjects() {
  const { subjects, loading, loadError, addSubject, deleteSubject } = useData();
  const [name, setName] = useState("");
  const [type, setType] = useState("theory");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (subjects.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
      setError("That subject already exists.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addSubject({ name: clean, type });
      setName("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(subject) {
    const ok = window.confirm(
      `Delete ${subject.name}? Its tasks and classes will be deleted too.`,
    );
    if (!ok) return;
    setError("");
    try {
      await deleteSubject(subject._id);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  const theoryCount = subjects.filter((s) => s.type === "theory").length;
  const practicalCount = subjects.length - theoryCount;

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-2xl font-bold">Subjects</h2>
      <p className="mb-4 text-sm text-slate-500">
        {subjects.length} subjects: {theoryCount} theory, {practicalCount}{" "}
        practical
      </p>

      <form
        onSubmit={handleAdd}
        className="mb-2 flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Subject name (e.g. Physics)"
          maxLength={40}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
        >
          <option value="theory">Theory</option>
          <option value="practical">Practical</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          Add
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {subjects.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No subjects yet. Add the ones from your timetable.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {subjects.map((s) => (
            <li
              key={s._id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
                {s.type}
              </span>
              <button
                onClick={() => handleDelete(s)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Subjects;
