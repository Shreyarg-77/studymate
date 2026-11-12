import { useState } from "react";
import { useData } from "../context/DataContext";
import { errorMessage } from "../api/client";

const DAYS = [
  { value: 1, short: "Mon", full: "Monday" },
  { value: 2, short: "Tue", full: "Tuesday" },
  { value: 3, short: "Wed", full: "Wednesday" },
  { value: 4, short: "Thu", full: "Thursday" },
  { value: 5, short: "Fri", full: "Friday" },
  { value: 6, short: "Sat", full: "Saturday" },
];

function Timetable() {
  const {
    subjects,
    timetable,
    loading,
    loadError,
    addSubject,
    addClasses,
    updateClass,
    deleteClass,
  } = useData();

  const [name, setName] = useState("");
  const [type, setType] = useState("theory");
  const [days, setDays] = useState([]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [room, setRoom] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const existing = subjects.find(
    (s) => s.name.toLowerCase() === name.trim().toLowerCase(),
  );
  const shownType = existing ? existing.type : type;

  function toggleDay(value) {
    if (editingId) {
      setDays([value]);
      return;
    }
    setDays(
      days.includes(value) ? days.filter((d) => d !== value) : [...days, value],
    );
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setDays([]);
    setStart("09:00");
    setEnd("10:00");
    setRoom("");
    setError("");
  }

  function startEdit(entry) {
    const subject = subjects.find((s) => s._id === entry.subject);
    setEditingId(entry._id);
    setName(subject ? subject.name : "");
    setDays([entry.day]);
    setStart(entry.start);
    setEnd(entry.end);
    setRoom(entry.room || "");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function findClash(day) {
    return timetable.find(
      (en) =>
        en._id !== editingId &&
        en.day === day &&
        start < en.end &&
        end > en.start,
    );
  }

  function clashMessage(clash, day) {
    const clashSubject = subjects.find((s) => s._id === clash.subject);
    const dayName = DAYS.find((d) => d.value === day).full;
    return `Clashes with ${clashSubject ? clashSubject.name : "another class"} on ${dayName} (${clash.start} - ${clash.end}).`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) return setError("Enter a subject name.");
    if (days.length === 0) {
      return setError(editingId ? "Select a day." : "Select at least one day.");
    }
    if (end <= start) return setError("End time must be after start time.");

    for (const day of days) {
      const clash = findClash(day);
      if (clash) return setError(clashMessage(clash, day));
    }

    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await updateClass(editingId, {
          day: days[0],
          start,
          end,
          room: room.trim(),
        });
        resetForm();
      } else {
        const subject =
          existing || (await addSubject({ name: cleanName, type }));
        await addClasses({
          subject: subject._id,
          days,
          start,
          end,
          room: room.trim(),
        });
        setName("");
        setDays([]);
        setRoom("");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClass(id) {
    const entry = timetable.find((e) => e._id === id);
    const subject = entry
      ? subjects.find((s) => s._id === entry.subject)
      : null;
    const dayName = entry ? DAYS.find((d) => d.value === entry.day)?.full : "";
    const label = subject ? `${subject.name} on ${dayName}` : "this class";
    if (!window.confirm(`Delete ${label}?`)) return;
    setError("");
    try {
      await deleteClass(id);
      if (editingId === id) resetForm();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  const theoryCount = subjects.filter((s) => s.type === "theory").length;
  const practicalCount = subjects.length - theoryCount;

  const inputClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500";

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="mb-1 text-2xl font-bold">Timetable</h2>
      <p className="mb-4 text-sm text-slate-500">
        {subjects.length} subjects: {theoryCount} theory, {practicalCount}{" "}
        practical · {timetable.length} classes per week
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        {editingId && (
          <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800 sm:col-span-2">
            Editing one class. You can change its day, time and room. To change
            the subject, delete the class and add it again.
          </p>
        )}

        <div>
          <input
            list="subject-names"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={Boolean(editingId)}
            placeholder="Subject name (e.g. Physics)"
            maxLength={40}
            className={`${inputClass} w-full`}
          />
          <datalist id="subject-names">
            {subjects.map((s) => (
              <option key={s._id} value={s.name} />
            ))}
          </datalist>
        </div>

        <select
          value={shownType}
          onChange={(e) => setType(e.target.value)}
          disabled={Boolean(existing) || Boolean(editingId)}
          className={inputClass}
        >
          <option value="theory">Theory</option>
          <option value="practical">Practical</option>
        </select>

        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-medium text-slate-500">
            {editingId ? "Day" : "Days"}
          </p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                type="button"
                key={d.value}
                onClick={() => toggleDay(d.value)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  days.includes(d.value)
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {d.short}
              </button>
            ))}
          </div>
        </div>

        <label className="text-xs font-medium text-slate-500">
          Start
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <label className="text-xs font-medium text-slate-500">
          End
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Room (optional)"
          maxLength={30}
          className={`${inputClass} sm:col-span-2`}
        />

        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add class"}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DAYS.map((d) => {
          const dayEntries = timetable
            .filter((en) => en.day === d.value)
            .sort((a, b) => a.start.localeCompare(b.start));

          return (
            <div
              key={d.value}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <h3 className="mb-2 text-sm font-bold text-slate-700">
                {d.full}
              </h3>
              {dayEntries.length === 0 ? (
                <p className="text-xs text-slate-400">No classes</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {dayEntries.map((en) => {
                    const subject = subjects.find((s) => s._id === en.subject);
                    return (
                      <li
                        key={en._id}
                        className={`flex items-start justify-between gap-2 rounded-md border-l-4 p-2 ${
                          en._id === editingId ? "bg-indigo-50" : "bg-slate-50"
                        }`}
                        style={{
                          borderLeftColor: subject ? subject.color : "#94A3B8",
                        }}
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {subject ? subject.name : "Unknown subject"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {en.start} - {en.end}
                            {en.room && ` · ${en.room}`}
                          </p>
                          {subject && (
                            <span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] capitalize text-slate-600">
                              {subject.type}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(en)}
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClass(en._id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Timetable;
