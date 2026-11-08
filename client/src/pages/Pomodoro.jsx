import { useState, useEffect, useCallback } from "react";
import { isToday, parseISO } from "date-fns";
import api from "../api/client";
import { useData } from "../context/DataContext";
import useLocalStorage from "../hooks/useLocalStorage";

const DEFAULTS = { focus: 60, short: 5, long: 15, longEvery: 4 };
const LIMITS = { focus: [1, 180], short: [1, 60], long: [1, 60] };
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
  const { tasks } = useData();
  const [settings, setSettings] = useLocalStorage(
    "studymate-pomodoro-settings-v2",
    DEFAULTS,
  );
  const [sessions, setSessions] = useState([]);
  const [saveWarning, setSaveWarning] = useState("");

  const [mode, setMode] = useState("focus");
  const [running, setRunning] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [remainingMs, setRemainingMs] = useState(settings.focus * 60000);
  const [now, setNow] = useState(() => Date.now());
  const [cycle, setCycle] = useState(0);
  const [taskId, setTaskId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("/pomodoro")
      .then((res) => {
        if (!cancelled) setSessions(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const msLeft = running ? Math.max(endTime - now, 0) : remainingMs;
  const totalMs = settings[mode] * 60000;

  const totalSec = Math.ceil(msLeft / 1000);
  const timeText = `${String(Math.floor(totalSec / 60)).padStart(2, "0")}:${String(totalSec % 60).padStart(2, "0")}`;

  const switchMode = useCallback(
    (next) => {
      setMode(next);
      setRunning(false);
      setEndTime(null);
      setEditing(false);
      setRemainingMs(settings[next] * 60000);
    },
    [settings],
  );

  const finishSession = useCallback(() => {
    beep();
    if (mode === "focus") {
      notify("Focus session complete. Time for a break.");
      api
        .post("/pomodoro", { task: taskId || null, minutes: settings.focus })
        .then((res) => {
          setSessions((prev) => [...prev, res.data]);
          setSaveWarning("");
        })
        .catch(() =>
          setSaveWarning("Session finished but could not be saved."),
        );
      const nextCycle = cycle + 1;
      setCycle(nextCycle);
      switchMode(nextCycle % settings.longEvery === 0 ? "long" : "short");
    } else {
      notify("Break over. Ready to focus?");
      switchMode("focus");
    }
  }, [mode, cycle, settings, taskId, switchMode]);

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

  function setDuration(value) {
    if (running) return;
    const [min, max] = LIMITS[mode];
    const minutes = Math.min(
      Math.max(Math.round(Number(value)) || settings[mode], min),
      max,
    );
    setSettings({ ...settings, [mode]: minutes });
    setRemainingMs(minutes * 60000);
  }

  function startEditing() {
    if (running) return;
    setDraft(String(settings[mode]));
    setEditing(true);
  }

  function commitEditing() {
    setDuration(draft);
    setEditing(false);
  }

  const incompleteTasks = tasks.filter((t) => !t.completed);
  const todaySessions = sessions.filter((s) =>
    isToday(parseISO(s.completedAt)),
  );
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.minutes, 0);

  const stepButton =
    "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100";

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

      <div className={`relative mx-auto mb-3 h-64 w-64 ${MODE_COLOR[mode]}`}>
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

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {editing ? (
            <div className="flex items-baseline gap-1">
              <input
                type="number"
                autoFocus
                min={LIMITS[mode][0]}
                max={LIMITS[mode][1]}
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
              disabled={running}
              title={running ? "" : "Click to change the time"}
              className="text-5xl font-bold text-slate-900 enabled:hover:text-indigo-600 disabled:cursor-default"
            >
              {timeText}
            </button>
          )}

          {!running && !editing && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setDuration(settings[mode] - STEP_DOWN)}
                className={stepButton}
              >
                −{STEP_DOWN}
              </button>
              <button
                type="button"
                onClick={() => setDuration(settings[mode] + STEP_UP)}
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
        its own length on this device.
      </p>

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
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
        >
          <option value="">No task selected</option>
          {incompleteTasks.map((t) => (
            <option key={t._id} value={t._id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-left">
        <p className="text-sm text-slate-500">Today</p>
        <p className="text-lg font-bold">
          {todaySessions.length} session{todaySessions.length === 1 ? "" : "s"}{" "}
          · {todayMinutes} min focused
        </p>
        {saveWarning && (
          <p className="mt-1 text-xs text-red-600">{saveWarning}</p>
        )}
      </div>
    </div>
  );
}

export default Pomodoro;
