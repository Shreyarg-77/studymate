import { useState } from "react";
import { useData } from "../context/DataContext";
import { usePomodoro } from "../context/PomodoroContext";

const STEP_DOWN = 10;
const STEP_UP = 15;

const MODES = [
  { key: "focus", label: "Focus" },
  { key: "short", label: "Short break" },
  { key: "long", label: "Long break" },
];

const MODE_COLOR = {
  focus: "text-indigo-600",
  short: "text-teal-600",
  long: "text-sky-600",
};

const RADIUS = 90;
const CIRC = 2 * Math.PI * RADIUS;

function Pomodoro() {
  const { tasks, subjects } = useData();
  const p = usePomodoro();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEditing() {
    if (p.running) return;
    setDraft(String(p.settings[p.mode]));
    setEditing(true);
  }

  function commitEditing() {
    p.setDuration(draft);
    setEditing(false);
  }

  const incompleteTasks = tasks.filter((t) => !t.completed);

  const stepButton =
    "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100";

  return (
    <div className="mx-auto max-w-md text-center">
      <h2 className="mb-4 text-left text-2xl font-bold">Pomodoro</h2>

      <div className="mb-6 flex justify-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => {
              setEditing(false);
              p.switchMode(m.key);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              p.mode === m.key
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={`relative mx-auto mb-3 h-64 w-64 ${MODE_COLOR[p.mode]}`}>
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            className="stroke-slate-200"
          />
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - p.msLeft / p.totalMs)}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {editing ? (
            <div className="flex items-baseline gap-1">
              <input
                type="number"
                autoFocus
                min={p.limits[0]}
                max={p.limits[1]}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEditing}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditing();
                }}
                className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-4xl font-bold text-slate-900 outline-none focus:border-indigo-500"
              />
              <span className="text-sm text-slate-500">min</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              disabled={p.running}
              title={p.running ? "" : "Click to change the time"}
              className="text-5xl font-bold text-slate-900 enabled:hover:text-indigo-600 disabled:cursor-default"
            >
              {p.timeText}
            </button>
          )}

          {!p.running && !editing && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => p.setDuration(p.settings[p.mode] - STEP_DOWN)}
                className={stepButton}
              >
                −{STEP_DOWN}
              </button>
              <button
                type="button"
                onClick={() => p.setDuration(p.settings[p.mode] + STEP_UP)}
                className={stepButton}
              >
                +{STEP_UP}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mb-6 text-xs text-slate-400">
        Tap the time to type your own minutes, or use −/+. Each mode remembers
        its own length on this device. The timer keeps running if you open
        another page.
      </p>

      <div className="mb-6 flex justify-center gap-3">
        {p.running ? (
          <button
            onClick={p.pause}
            className="rounded-lg bg-slate-800 px-6 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={() => p.start()}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Start
          </button>
        )}
        <button
          onClick={p.reset}
          className="rounded-lg border border-slate-300 px-6 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Reset
        </button>
      </div>

      <div className="mb-6 text-left">
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Working on (optional)
        </label>
        <select
          value={p.taskId}
          onChange={(e) => p.setTaskId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
        >
          <option value="">No task selected</option>
          {incompleteTasks.map((t) => (
            <option key={t._id} value={t._id}>
              {t.title} ·{" "}
              {subjects.find((s) => s._id === t.subject)?.name || "No subject"}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-left">
        <p className="text-sm text-slate-500">Today</p>
        <p className="text-lg font-bold">
          {p.todaySessions.length} session
          {p.todaySessions.length === 1 ? "" : "s"} · {p.todayMinutes} min
          focused
        </p>
        {p.saveWarning && (
          <p className="mt-1 text-xs text-red-600">{p.saveWarning}</p>
        )}
      </div>
    </div>
  );
}

export default Pomodoro;
