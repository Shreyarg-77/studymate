import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { isToday, parseISO } from "date-fns";
import api from "../api/client";
import useLocalStorage from "../hooks/useLocalStorage";

const DEFAULTS = { focus: 60, short: 5, long: 15, longEvery: 4 };
const LIMITS = { focus: [1, 180], short: [1, 60], long: [1, 60] };

const PomodoroContext = createContext(null);

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
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("StudyMate", { body: text });
    }
  } catch {
    // some mobile browsers do not allow this constructor
  }
}

export function PomodoroProvider({ children }) {
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

  function start(askPermission = true) {
    if (running) return;
    const t = Date.now();
    setNow(t);
    setEndTime(t + remainingMs);
    setRunning(true);
    if (
      askPermission &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }

  function pause() {
    if (!running) return;
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

  const todaySessions = sessions.filter((s) =>
    isToday(parseISO(s.completedAt)),
  );
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.minutes, 0);

  const value = {
    settings,
    mode,
    running,
    msLeft,
    totalMs,
    timeText,
    taskId,
    setTaskId,
    saveWarning,
    todaySessions,
    todayMinutes,
    limits: LIMITS[mode],
    start,
    pause,
    reset,
    switchMode,
    setDuration,
  };

  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePomodoro() {
  return useContext(PomodoroContext);
}
