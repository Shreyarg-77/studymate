import { useState, useEffect, useCallback } from "react";
import { isToday, parseISO } from "date-fns";
import useLocalStorage from "../hooks/useLocalStorage";

const DEFAULTS = { focus: 25, short: 5, long: 15, longEvery: 4 };

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

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // sound is optional
  }
}

function notify(text) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("StudyMate", { body: text });
  }
}

function Pomodoro() {
  const [settings, setSettings] = useLocalStorage(
    "studymate-pomodoro-settings",
    DEFAULTS,
  );
  const [sessions, setSessions] = useLocalStorage(
    "studymate-pomodoro-sessions",
    [],
  );
  const [tasks] = useLocalStorage("studymate-tasks-v2", []);

  const [mode, setMode] = useState("focus");
  const [running, setRunning] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [remainingMs, setRemainingMs] = useState(settings.focus * 60000);
  const [now, setNow] = useState(() => Date.now());
  const [cycle, setCycle] = useState(0);
  const [taskId, setTaskId] = useState("");

  const msLeft = running ? Math.max(endTime - now, 0) : remainingMs;
  const totalMs = settings[mode] * 60000;

  const totalSec = Math.ceil(msLeft / 1000);
  const timeText = `${String(Math.floor(totalSec / 60)).padStart(2, "0")}:${String(totalSec % 60).padStart(2, "0")}`;

  const switchMode = useCallback(
    (next) => {
      setMode(next);
      setRunning(false);
      setEndTime(null);
      setRemainingMs(settings[next] * 60000);
    },
    [settings],
  );

  const finishSession = useCallback(() => {
    beep();
    if (mode === "focus") {
      notify("Focus session complete. Time for a break.");
      setSessions((prev) => [
        ...prev,
        {
          id: Date.now(),
          taskId: taskId ? Number(taskId) : null,
          minutes: settings.focus,
          completedAt: new Date().toISOString(),
        },
      ]);
      const nextCycle = cycle + 1;
      setCycle(nextCycle);
      switchMode(nextCycle % settings.longEvery === 0 ? "long" : "short");
    } else {
      notify("Break over. Ready to focus?");
      switchMode("focus");
    }
  }, [mode, cycle, settings, taskId, switchMode, setSessions]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const t = Date.now();
      if (t >= endTime) {
        finishSession();
      } else {
        setNow(t);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, endTime, finishSession]);

  useEffect(() => {
    document.title = running ? `${timeText} - StudyMate` : "StudyMate";
    return () => {
      document.title = "StudyMate";
    };
  }, [running, timeText]);

  function start() {
    const t = Date.now();
    setNow(t);
    setEndTime(t + remainingMs);
    setRunning(true);
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function pause() {
    setRemainingMs(Math.max(endTime - Date.now(), 0));
    setRunning(false);
    setEndTime(null);
  }

  function reset() {
    setRunning(false);
    setEndTime(null);
    setRemainingMs(settings[mode] * 60000);
  }

  function updateSetting(key, value) {
    const next = { ...settings, [key]: Number(value) };
    setSettings(next);
    if (!running && key === mode) setRemainingMs(next[key] * 60000);
  }

  const incompleteTasks = tasks.filter((t) => !t.completed);
  const todaySessions = sessions.filter((s) =>
    isToday(parseISO(s.completedAt)),
  );
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.minutes, 0);

  const selectClass =
    "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-50";

  return (
    <div className="mx-auto max-w-md text-center">
      <h2 className="mb-4 text-left text-2xl font-bold">Pomodoro</h2>

      <div className="mb-6 flex justify-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => switchMode(m.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              mode === m.key
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={`relative mx-auto mb-6 h-64 w-64 ${MODE_COLOR[mode]}`}>
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
            strokeDashoffset={CIRC * (1 - msLeft / totalMs)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl font-bold text-slate-900">{timeText}</span>
        </div>
      </div>

      <div className="mb-6 flex justify-center gap-3">
        {running ? (
          <button
            onClick={pause}
            className="rounded-lg bg-slate-800 px-6 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={start}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Start
          </button>
        )}
        <button
          onClick={reset}
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
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className={`${selectClass} w-full`}
        >
          <option value="">No task selected</option>
          {incompleteTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-left">
        <p className="text-sm text-slate-500">Today</p>
        <p className="text-lg font-bold">
          {todaySessions.length} session{todaySessions.length === 1 ? "" : "s"}{" "}
          · {todayMinutes} min focused
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-left">
        <label className="text-xs font-medium text-slate-500">
          Focus (min)
          <select
            value={settings.focus}
            onChange={(e) => updateSetting("focus", e.target.value)}
            disabled={running}
            className={`${selectClass} mt-1 w-full`}
          >
            {[1, 15, 20, 25, 30, 45, 50, 60].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          Short break
          <select
            value={settings.short}
            onChange={(e) => updateSetting("short", e.target.value)}
            disabled={running}
            className={`${selectClass} mt-1 w-full`}
          >
            {[1, 3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          Long break
          <select
            value={settings.long}
            onChange={(e) => updateSetting("long", e.target.value)}
            disabled={running}
            className={`${selectClass} mt-1 w-full`}
          >
            {[10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-left text-xs text-slate-400">
        Tip: set Focus to 1 minute to test the full cycle quickly.
      </p>
    </div>
  );
}

export default Pomodoro;
