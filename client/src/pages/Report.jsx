import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import api, { errorMessage } from "../api/client";
import { useData } from "../context/DataContext";

const todayStr = () => format(new Date(), "yyyy-MM-dd");

function dayRange(date) {
  const start = startOfDay(parseISO(date));
  return { from: start.toISOString(), to: addDays(start, 1).toISOString() };
}

function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const PRIORITY_STYLES = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-green-100 text-green-700",
};

function Row({ color, title, meta, tag, tagClass }) {
  return (
    <li
      className="flex items-center gap-3 rounded-lg border border-l-4 border-slate-200 bg-white p-3"
      style={{ borderLeftColor: color }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-slate-500">{meta}</p>
      </div>
      {tag && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${tagClass}`}
        >
          {tag}
        </span>
      )}
    </li>
  );
}

function Section({ title, count, children }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-sm font-bold text-slate-700">
        {title} <span className="font-normal text-slate-400">({count})</span>
      </h3>
      {count === 0 ? (
        <p className="text-sm text-slate-400">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-2">{children}</ul>
      )}
    </section>
  );
}

function Report() {
  const { tasks, subjects, loading, loadError } = useData();

  const [date, setDate] = useState(todayStr);
  const [report, setReport] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = dayRange(date);
    api
      .get("/report", { params: { date, from, to } })
      .then((res) => {
        if (!cancelled) setReport(res.data);
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
    setError("");
    setCopied(false);
    setFetching(true);
  }

  function shift(days) {
    changeDate(format(addDays(parseISO(date), days), "yyyy-MM-dd"));
  }

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  const today = todayStr();
  const isPast = date < today;

  const subjectOf = (item) => subjects.find((s) => s._id === item?.subject);
  const colorOf = (item) => subjectOf(item)?.color || "#94A3B8";
  const nameOf = (item) => subjectOf(item)?.name || "Unknown subject";

  const slotView = (slot) => {
    const task = tasks.find((t) => t._id === slot.task);
    return { slot, task };
  };

  const doneSlots = report
    ? report.slots.filter((s) => s.status === "done").map(slotView)
    : [];
  const plannedSlots = report
    ? report.slots.filter((s) => s.status === "planned").map(slotView)
    : [];
  const skippedSlots = report
    ? report.slots.filter((s) => s.status === "skipped").map(slotView)
    : [];

  const totals = report?.totals;
  const totalCount = totals
    ? totals.done.count + totals.planned.count + totals.skipped.count
    : 0;
  const totalMinutes = totals
    ? totals.done.minutes + totals.planned.minutes + totals.skipped.minutes
    : 0;
  const percent =
    totalMinutes > 0
      ? Math.round((totals.done.minutes / totalMinutes) * 100)
      : null;

  const openCount = report
    ? report.dueTasks.length + report.overdueTasks.length
    : 0;
  const allClear =
    report &&
    plannedSlots.length === 0 &&
    skippedSlots.length === 0 &&
    openCount === 0;

  function buildSummary() {
    const titleOf = ({ task }) => (task ? task.title : "Deleted task");
    const lines = [
      `StudyMate daily report - ${format(parseISO(date), "EEEE, d MMM yyyy")}`,
      "",
      `Study slots done: ${totals.done.count} of ${totalCount} (${formatMinutes(totals.done.minutes)} of ${formatMinutes(totalMinutes)})`,
      `Focus time: ${formatMinutes(report.focus.minutes)} in ${report.focus.sessions} session(s)`,
      `Tasks completed: ${report.completedTasks.length}`,
      ...report.completedTasks.map((t) => `  - ${t.title}`),
      "",
      `Left to do: ${plannedSlots.length + skippedSlots.length} slot(s), ${report.dueTasks.length} due task(s), ${report.overdueTasks.length} overdue task(s)`,
      ...plannedSlots.map(
        (v) => `  - ${titleOf(v)} (${v.slot.start}-${v.slot.end})`,
      ),
      ...skippedSlots.map((v) => `  - ${titleOf(v)} (skipped)`),
      ...report.dueTasks.map((t) => `  - ${t.title} (due)`),
      ...report.overdueTasks.map((t) => `  - ${t.title} (overdue)`),
    ];
    return lines.join("\n");
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildSummary());
      setCopied(true);
    } catch {
      setError(
        "Could not copy. Your browser may have blocked clipboard access.",
      );
    }
  }

  const navButton =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100";

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-2xl font-bold">Daily report</h2>
      <p className="mb-4 text-sm text-slate-500">
        What you finished, and what is still left, for one day.
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
          max={today}
          onChange={(e) => changeDate(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => shift(1)}
          disabled={date >= today}
          className={`${navButton} disabled:opacity-40`}
          aria-label="Next day"
        >
          →
        </button>
        {date !== today && (
          <button onClick={() => changeDate(today)} className={navButton}>
            Today
          </button>
        )}
        {report && !fetching && (
          <button onClick={copySummary} className={`${navButton} ml-auto`}>
            {copied ? "Copied" : "Copy summary"}
          </button>
        )}
      </div>

      <p className="mb-4 text-sm font-medium text-slate-700">
        {format(parseISO(date), "EEEE, d MMMM yyyy")}
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {fetching || !report ? (
        <p className="text-sm text-slate-500">
          {error ? "" : "Loading report..."}
        </p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xl font-bold">
                {totals.done.count}/{totalCount}
              </p>
              <p className="text-xs text-slate-500">Study slots done</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xl font-bold text-green-700">
                {formatMinutes(totals.done.minutes)}
              </p>
              <p className="text-xs text-slate-500">
                studied of {formatMinutes(totalMinutes)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xl font-bold text-indigo-600">
                {formatMinutes(report.focus.minutes)}
              </p>
              <p className="text-xs text-slate-500">
                focus · {report.focus.sessions} Pomodoro
                {report.focus.sessions === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xl font-bold">
                {report.completedTasks.length}
              </p>
              <p className="text-xs text-slate-500">Tasks completed</p>
            </div>
          </div>

          {percent !== null && (
            <div className="mb-6">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Study plan progress</span>
                <span>{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}

          {totalCount === 0 &&
            report.completedTasks.length === 0 &&
            report.focus.sessions === 0 && (
              <p className="mb-6 text-sm text-slate-500">
                No study activity was recorded on this day.{" "}
                <Link
                  to="/plan"
                  className="font-medium text-indigo-600 underline"
                >
                  Open the study plan
                </Link>
              </p>
            )}

          <h3 className="mb-3 border-b border-slate-200 pb-1 text-base font-bold text-green-700">
            Completed
          </h3>

          <Section title="Tasks finished" count={report.completedTasks.length}>
            {report.completedTasks.map((t) => (
              <Row
                key={t._id}
                color={colorOf(t)}
                title={t.title}
                meta={`${nameOf(t)} · finished at ${format(parseISO(t.completedAt), "h:mm a")}`}
                tag={t.priority}
                tagClass={PRIORITY_STYLES[t.priority]}
              />
            ))}
          </Section>

          <Section title="Study slots done" count={doneSlots.length}>
            {doneSlots.map(({ slot, task }) => (
              <Row
                key={slot._id}
                color={colorOf(task)}
                title={task ? task.title : "Deleted task"}
                meta={`${nameOf(task)} · ${slot.start} - ${slot.end}`}
                tag={`${slot.minutes} min`}
                tagClass="bg-green-100 text-green-700"
              />
            ))}
          </Section>

          <h3 className="mb-3 mt-8 border-b border-slate-200 pb-1 text-base font-bold text-amber-700">
            Left to do
          </h3>

          {allClear && (
            <p className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              Nothing is left over for this day. Well done.
            </p>
          )}

          <Section
            title={isPast ? "Missed study slots" : "Study slots still to do"}
            count={plannedSlots.length}
          >
            {plannedSlots.map(({ slot, task }) => (
              <Row
                key={slot._id}
                color={colorOf(task)}
                title={task ? task.title : "Deleted task"}
                meta={`${nameOf(task)} · ${slot.start} - ${slot.end}`}
                tag={`${slot.minutes} min`}
                tagClass="bg-slate-100 text-slate-600"
              />
            ))}
          </Section>

          <Section title="Skipped study slots" count={skippedSlots.length}>
            {skippedSlots.map(({ slot, task }) => (
              <Row
                key={slot._id}
                color={colorOf(task)}
                title={task ? task.title : "Deleted task"}
                meta={`${nameOf(task)} · ${slot.start} - ${slot.end}`}
                tag="skipped"
                tagClass="bg-amber-100 text-amber-700"
              />
            ))}
          </Section>

          <Section
            title={isPast ? "Tasks that were due this day" : "Tasks due today"}
            count={report.dueTasks.length}
          >
            {report.dueTasks.map((t) => (
              <Row
                key={t._id}
                color={colorOf(t)}
                title={t.title}
                meta={`${nameOf(t)} · ${t.estimatedMins ?? 60} min`}
                tag={t.priority}
                tagClass={PRIORITY_STYLES[t.priority]}
              />
            ))}
          </Section>

          <Section title="Overdue tasks" count={report.overdueTasks.length}>
            {report.overdueTasks.map((t) => (
              <Row
                key={t._id}
                color={colorOf(t)}
                title={t.title}
                meta={`${nameOf(t)} · was due ${format(parseISO(t.dueDate), "d MMM")}`}
                tag={t.priority}
                tagClass={PRIORITY_STYLES[t.priority]}
              />
            ))}
          </Section>

          <h3 className="mb-3 mt-8 border-b border-slate-200 pb-1 text-base font-bold text-indigo-700">
            Next up
          </h3>

          <p className="mb-3 text-sm text-slate-600">
            {report.next.plannedCount > 0
              ? `${format(parseISO(report.next.date), "EEEE")} already has ${report.next.plannedCount} planned slot${report.next.plannedCount === 1 ? "" : "s"} (${formatMinutes(report.next.plannedMinutes)}).`
              : `Nothing is planned for ${format(parseISO(report.next.date), "EEEE")} yet.`}{" "}
            <Link to="/plan" className="font-medium text-indigo-600 underline">
              Open the study plan
            </Link>
          </p>

          <Section
            title="Most urgent open tasks"
            count={report.next.topTasks.length}
          >
            {report.next.topTasks.map((t) => (
              <Row
                key={t._id}
                color={colorOf(t)}
                title={t.title}
                meta={`${nameOf(t)}${t.dueDate ? ` · due ${format(parseISO(t.dueDate), "d MMM")}` : ""}`}
                tag={t.priority}
                tagClass={PRIORITY_STYLES[t.priority]}
              />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

export default Report;
