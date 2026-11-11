import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const nowStr = () => format(new Date(), "HH:mm");

const STATUS_STYLES = {
  planned: "bg-slate-100 text-slate-600",
  done: "bg-green-100 text-green-700",
  skipped: "bg-amber-100 text-amber-700",
};

const PRIORITY_STYLES = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-green-100 text-green-700",
};
const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 };

function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function urgency(task) {
  const base = PRIORITY_WEIGHT[task.priority] * 10;
  if (!task.dueDate) return base;
  const left = differenceInCalendarDays(parseISO(task.dueDate), new Date());
  if (left < 0) return base + 25;
  return base + 10 / Math.max(left, 0.5);
}

/* Which tasks the user left out of a given day's plan, remembered per day. */
const storageKey = (userId) => `studymate-plan-excluded-${userId}`;

function loadExcluded(userId, date) {
  try {
    const all = JSON.parse(localStorage.getItem(storageKey(userId)) || "{}");
    return Array.isArray(all[date]) ? all[date] : [];
  } catch {
    return [];
  }
}

function saveExcluded(userId, date, ids) {
  try {
    const key = storageKey(userId);
    const all = JSON.parse(localStorage.getItem(key) || "{}");
    const today = todayStr();
    for (const d of Object.keys(all)) {
      if (d < today) delete all[d];
    }
    if (ids.length > 0) all[date] = ids;
    else delete all[date];
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    // storage may be unavailable
  }
}

function StudyPlan() {
  const { user } = useAuth();
  const { tasks, subjects, timetable, loading, loadError } = useData();
  const userId = user?.id;

  const [date, setDate] = useState(todayStr);
  const [slots, setSlots] = useState([]);
  const [summary, setSummary] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [excluded, setExcluded] = useState(() =>
    loadExcluded(userId, todayStr()),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDirty, setPickerDirty] = useState(false);

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

  const pendingTasks = tasks.filter((t) => !t.completed);
  const pickerTasks = [...pendingTasks].sort((a, b) => urgency(b) - urgency(a));
  const selected = pendingTasks.filter((t) => !excluded.includes(t._id));

  function changeDate(next) {
    if (!next || next === date) return;
    setDate(next);
    setExcluded(loadExcluded(userId, next));
    setSummary(null);
    setError("");
    setPickerDirty(false);
    setFetching(true);
  }

  function shift(days) {
    changeDate(format(addDays(parseISO(date), days), "yyyy-MM-dd"));
  }

  function setExcludedIds(next) {
    setExcluded(next);
    saveExcluded(userId, date, next);
    setPickerDirty(true);
  }

  function toggleTask(id) {
    setExcludedIds(
      excluded.includes(id)
        ? excluded.filter((x) => x !== id)
        : [...excluded, id],
    );
  }

  async function generate() {
    if (selected.length === 0) {
      setError("Tick at least one task to plan.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/slots/generate", {
        date,
        today: todayStr(),
        now: nowStr(),
        taskIds: selected.map((t) => t._id),
      });
      setSlots(res.data.slots);
      setSummary({
        unscheduled: res.data.unscheduled,
        freeMinutes: res.data.freeMinutes,
        plannedMinutes: res.data.plannedMinutes,
      });
      setPickerDirty(false);
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
  const tomorrow = format(addDays(parseISO(date), 1), "yyyy-MM-dd");

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
  const urgentUnscheduled = unscheduled.filter(
    (u) => u.task?.dueDate && u.task.dueDate <= date,
  );

  const navButton =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40";

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
          disabled={busy}
          className={navButton}
          aria-label="Previous day"
        >
          ←
        </button>
        <input
          type="date"
          value={date}
          disabled={busy}
          onChange={(e) => changeDate(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-40"
        />
        <button
          onClick={() => shift(1)}
          disabled={busy}
          className={navButton}
          aria-label="Next day"
        >
          →
        </button>
        {date !== today && (
          <button
            onClick={() => changeDate(today)}
            disabled={busy}
            className={navButton}
          >
            Today
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={generate}
          disabled={busy || isPast || selected.length === 0}
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

      {!isPast && pendingTasks.length > 0 && (
        <section className="mb-4 rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="text-sm font-medium text-slate-700">
              Choose tasks to plan
            </span>
            <span className="text-xs text-slate-500">
              {selected.length} of {pendingTasks.length} selected{" "}
              {pickerOpen ? "▲" : "▼"}
            </span>
          </button>

          {pickerOpen && (
            <div className="border-t border-slate-100 p-3">
              <p className="mb-2 text-xs text-slate-500">
                Untick anything you do not want to work on this day. Unticked
                tasks stay on your task list.
              </p>
              <div className="mb-2 flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setExcludedIds([])}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setExcludedIds(pendingTasks.map((t) => t._id))}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  Select none
                </button>
              </div>

              <ul className="flex flex-col gap-1">
                {pickerTasks.map((t) => {
                  const subject = subjects.find((s) => s._id === t.subject);
                  const overdue = t.dueDate && t.dueDate < today;
                  return (
                    <li key={t._id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={!excluded.includes(t._id)}
                          onChange={() => toggleTask(t._id)}
                          className="h-4 w-4"
                        />
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: subject
                              ? subject.color
                              : "#94A3B8",
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {t.title}
                          </span>
                          <span
                            className={`block text-xs ${overdue ? "text-red-600" : "text-slate-500"}`}
                          >
                            {subject ? subject.name : "Unknown subject"} ·{" "}
                            {t.estimatedMins ?? 60} min
                            {t.dueDate
                              ? ` · ${overdue ? "was due" : "due"} ${format(parseISO(t.dueDate), "d MMM")}`
                              : ""}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLES[t.priority]}`}
                        >
                          {t.priority}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {pickerDirty && !busy && (
        <p className="mb-4 text-xs text-indigo-700">
          Your task selection changed. Click "Regenerate plan" to apply it.
        </p>
      )}

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
          Free time before breaks: {formatMinutes(summary.freeMinutes)} · Newly
          planned: {formatMinutes(summary.plannedMinutes)}
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
            Not planned for this day
          </p>
          <p className="mb-2 text-sm text-amber-800">
            This day's free time ran out. Breaks between slots and small gaps
            left over cannot be used for study, so these tasks are not fully
            planned:
          </p>
          <ul className="mb-2 list-inside list-disc text-sm text-amber-900">
            {unscheduled.map((u) => (
              <li key={u.task?._id || u.minutes}>
                {u.task ? u.task.title : "A task"} · {formatMinutes(u.minutes)}{" "}
                still unplanned
              </li>
            ))}
          </ul>

          {urgentUnscheduled.length > 0 && (
            <p className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
              Due on or before this day:{" "}
              {urgentUnscheduled.map((u) => u.task.title).join(", ")}. Consider
              lowering the estimate, shortening breaks or removing a blocked
              time in Settings, or starting this work earlier.
            </p>
          )}

          <p className="mb-2 text-xs text-amber-700">
            They stay on your task list. Plan another day and they will be
            included automatically.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <button
              onClick={() => changeDate(tomorrow)}
              disabled={busy}
              className="font-medium text-indigo-700 underline disabled:opacity-40"
            >
              Go to {format(parseISO(tomorrow), "EEEE")}
            </button>
            <Link
              to="/settings"
              className="font-medium text-indigo-700 underline"
            >
              Open settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudyPlan;
