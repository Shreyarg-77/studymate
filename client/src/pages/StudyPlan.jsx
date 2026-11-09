import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import api, { errorMessage } from "../api/client";
import { useData } from "../context/DataContext";

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const nowStr = () => format(new Date(), "HH:mm");

const STATUS_STYLES = {
  planned: "bg-slate-100 text-slate-600",
  done: "bg-green-100 text-green-700",
  skipped: "bg-amber-100 text-amber-700",
};

function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function StudyPlan() {
  const { tasks, subjects, timetable, loading, loadError } = useData();

  const [date, setDate] = useState(todayStr);
  const [slots, setSlots] = useState([]);
  const [summary, setSummary] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("/slots", { params: { date } })
      .then((res) => {
        if (!cancelled) setSlots(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  function changeDate(next) {
    if (!next || next === date) return;
    setDate(next);
    setSummary(null);
    setError("");
    setFetching(true);
  }

  function shift(days) {
    changeDate(format(addDays(parseISO(date), days), "yyyy-MM-dd"));
  }

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/slots/generate", {
        date,
        today: todayStr(),
        now: nowStr(),
      });
      setSlots(res.data.slots);
      setSummary({
        unscheduled: res.data.unscheduled,
        freeMinutes: res.data.freeMinutes,
        plannedMinutes: res.data.plannedMinutes,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(slot, status) {
    setError("");
    try {
      const res = await api.patch(`/slots/${slot._id}`, { status });
      setSlots((prev) => prev.map((s) => (s._id === slot._id ? res.data : s)));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  const today = todayStr();
  const isPast = date < today;
  const weekday = parseISO(date).getDay();
  const pendingTasks = tasks.filter((t) => !t.completed);

  const classItems = timetable
    .filter((c) => c.day === weekday)
    .map((c) => ({
      kind: "class",
      key: c._id,
      start: c.start,
      end: c.end,
      room: c.room,
      subject: subjects.find((s) => s._id === c.subject),
    }));

  const slotItems = slots.map((s) => {
    const task = tasks.find((t) => t._id === s.task);
    return {
      kind: "slot",
      key: s._id,
      start: s.start,
      end: s.end,
      slot: s,
      task,
      subject: task ? subjects.find((x) => x._id === task.subject) : null,
    };
  });

  const items = [...classItems, ...slotItems].sort((a, b) =>
    a.start.localeCompare(b.start),
  );

  const totals = slots.reduce(
    (acc, s) => {
      acc[s.status] += s.minutes;
      return acc;
    },
    { planned: 0, done: 0, skipped: 0 },
  );

  const unscheduled = (summary?.unscheduled || []).map((u) => ({
    ...u,
    task: tasks.find((t) => t._id === u.task),
  }));

  const navButton =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100";

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-2xl font-bold">Study plan</h2>
      <p className="mb-4 text-sm text-slate-500">
        Free time between your classes, filled with your tasks by priority and
        deadline.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => shift(-1)}
          className={navButton}
          aria-label="Previous day"
        >
          ←
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => changeDate(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => shift(1)}
          className={navButton}
          aria-label="Next day"
        >
          →
        </button>
        {date !== today && (
          <button onClick={() => changeDate(today)} className={navButton}>
            Today
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={generate}
          disabled={busy || isPast}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy
            ? "Planning..."
            : slots.some((s) => s.status === "planned")
              ? "Regenerate plan"
              : "Generate plan"}
        </button>
        <span className="text-sm font-medium text-slate-700">
          {format(parseISO(date), "EEEE, d MMMM")}
        </span>
      </div>

      {isPast && (
        <p className="mb-4 text-xs text-slate-500">
          Plans can only be generated for today or later. You can still look
          back at what you did.
        </p>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!isPast && pendingTasks.length === 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          You have no pending tasks, so there is nothing to plan.{" "}
          <Link to="/" className="font-medium underline">
            Add a task
          </Link>
        </div>
      )}

      {timetable.length === 0 && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
          No classes are saved yet, so the whole day counts as free time.{" "}
          <Link
            to="/timetable"
            className="font-medium text-indigo-600 underline"
          >
            Add your timetable
          </Link>
        </div>
      )}

      {slots.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <p className="text-lg font-bold">{formatMinutes(totals.planned)}</p>
            <p className="text-xs text-slate-500">Planned</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <p className="text-lg font-bold text-green-700">
              {formatMinutes(totals.done)}
            </p>
            <p className="text-xs text-slate-500">Done</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <p className="text-lg font-bold text-amber-700">
              {formatMinutes(totals.skipped)}
            </p>
            <p className="text-xs text-slate-500">Skipped</p>
          </div>
        </div>
      )}

      {summary && (
        <p className="mb-4 text-xs text-slate-500">
          Free time found: {formatMinutes(summary.freeMinutes)} · Newly planned:{" "}
          {formatMinutes(summary.plannedMinutes)}
        </p>
      )}

      {fetching ? (
        <p className="text-sm text-slate-500">Loading plan...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">
          No classes or study slots on this day yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            if (item.kind === "class") {
              return (
                <li
                  key={`c-${item.key}`}
                  className="flex items-center gap-3 rounded-lg border-l-4 bg-slate-100 p-3"
                  style={{
                    borderLeftColor: item.subject
                      ? item.subject.color
                      : "#94A3B8",
                  }}
                >
                  <div className="w-24 shrink-0 text-xs font-medium text-slate-500">
                    {item.start} - {item.end}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">
                      {item.subject ? item.subject.name : "Class"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Class{item.room ? ` · ${item.room}` : ""}
                    </p>
                  </div>
                </li>
              );
            }

            const { slot, task, subject } = item;
            return (
              <li
                key={`s-${item.key}`}
                className={`flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 border-l-4 bg-white p-3 ${
                  slot.status === "skipped" ? "opacity-60" : ""
                }`}
                style={{ borderLeftColor: subject ? subject.color : "#94A3B8" }}
              >
                <div className="w-24 shrink-0 text-xs font-medium text-slate-500">
                  {slot.start} - {slot.end}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      slot.status === "done"
                        ? "text-slate-400 line-through"
                        : ""
                    }`}
                  >
                    {task ? task.title : "Deleted task"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{subject ? subject.name : "Unknown subject"}</span>
                    <span>· {slot.minutes} min</span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${STATUS_STYLES[slot.status]}`}
                    >
                      {slot.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  {slot.status === "planned" ? (
                    <>
                      <button
                        onClick={() => setStatus(slot, "done")}
                        className="text-green-700 hover:text-green-900"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => setStatus(slot, "skipped")}
                        className="text-amber-700 hover:text-amber-900"
                      >
                        Skip
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setStatus(slot, "planned")}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      Undo
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {unscheduled.length > 0 && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-1 text-sm font-bold text-amber-800">
            Could not fit on this day
          </p>
          <ul className="text-sm text-amber-800">
            {unscheduled.map((u) => (
              <li key={u.task?._id || u.minutes}>
                {u.task ? u.task.title : "A task"}: {formatMinutes(u.minutes)}{" "}
                left
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-amber-700">
            Try another day, or lower an estimate on the Tasks page.
          </p>
        </div>
      )}
    </div>
  );
}

export default StudyPlan;
