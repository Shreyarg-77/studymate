import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { format, isToday, parseISO } from "date-fns";
import api from "../api/client";
import useLocalStorage from "../hooks/useLocalStorage";

const DEFAULTS = { focus: 60, short: 5, long: 15, longEvery: 4 };
const LIMITS = { focus: [1, 180], short: [1, 60], long: [1, 60] };
const MIN_FINISH_MINS = 20;
const ADJUST_MINS = 10;

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
  const [notice, setNotice] = useState("");

  const [mode, setMode] = useState("focus");
  const [running, setRunning] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [remainingMs, setRemainingMs] = useState(settings.focus * 60000);
  const [extraMs, setExtraMs] = useState(0);
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

  const totalMs = settings[mode] * 60000 + extraMs;
  const msLeft = running ? Math.max(endTime - now, 0) : remainingMs;
  const elapsedMs = Math.max(totalMs - msLeft, 0);
  const active = running || elapsedMs > 0;
  const canFinish = mode === "focus" && elapsedMs >= MIN_FINISH_MINS * 60000;

  const totalSec = Math.ceil(msLeft / 1000);
  const timeText = `${String(Math.floor(totalSec / 60)).padStart(2, "0")}:${String(totalSec % 60).padStart(2, "0")}`;

  const switchMode = useCallback(
    (next) => {
      setMode(next);
      setRunning(false);
      setEndTime(null);
      setExtraMs(0);
      setRemainingMs(settings[next] * 60000);
    },
    [settings],
  );

  const logFocus = useCallback(
    (minutes) => {
      api
        .post("/pomodoro", {
          task: taskId || null,
          minutes,
          today: format(new Date(), "yyyy-MM-dd"),
        })
        .then((res) => {
          const { updatedTask, progress, ...session } = res.data;
          setSessions((prev) => [...prev, session]);
          setSaveWarning("");
          if (updatedTask?.completed && progress) {
            setNotice(
              `${updatedTask.title} is complete (${progress.doneMinutes} of ${progress.estimate} min of focus). It has left your plan and task list, and stays in your report.`,
            );
            setTaskId("");
          } else if (progress) {
            const left = Math.max(progress.estimate - progress.doneMinutes, 0);
            setNotice(
              `Saved ${minutes} min. About ${left} min of this task remain.`,
            );
          } else {
            setNotice(`Saved ${minutes} min of focus.`);
          }
        })
        .catch(() =>
          setSaveWarning("Session finished but could not be saved."),
        );
    },
    [taskId],
  );

  const nextAfterFocus = useCallback(() => {
    const nextCycle = cycle + 1;
    setCycle(nextCycle);
    switchMode(nextCycle % settings.longEvery === 0 ? "long" : "short");
  }, [cycle, settings.longEvery, switchMode]);

  const finishSession = useCallback(() => {
    beep();
    if (mode === "focus") {
      notify("Focus session complete. Time for a break.");
      logFocus(Math.max(Math.round(totalMs / 60000), 1));
      nextAfterFocus();
    } else {
      notify("Break over. Ready to focus?");
      setNotice("");
      switchMode("focus");
    }
  }, [mode, totalMs, logFocus, nextAfterFocus, switchMode]);

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
    setNotice("");
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
    setExtraMs(0);
    setRemainingMs(settings[mode] * 60000);
  }

  // Add or remove time while the timer is running or paused.
  function adjust(minutes) {
    if (!active) return;
    const maxTotal = LIMITS[mode][1] * 60000;
    const current = running ? Math.max(endTime - Date.now(), 0) : remainingMs;
    let next = Math.max(current + minutes * 60000, 60000);
    if (totalMs + (next - current) > maxTotal)
      next = current + (maxTotal - totalMs);
    const applied = next - current;
    if (applied === 0) return;
    setExtraMs((extra) => extra + applied);
    if (running) setEndTime(Date.now() + next);
    else setRemainingMs(next);
  }

  // Stop in the middle: allowed once at least MIN_FINISH_MINS of focus are done.
  function finishEarly() {
    if (!canFinish) return;
    const minutes = Math.min(Math.max(Math.round(elapsedMs / 60000), 1), 180);
    logFocus(minutes);
    nextAfterFocus();
  }

  function setDuration(value) {
    if (active) return;
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
    active,
    msLeft,
    totalMs,
    elapsedMs,
    timeText,
    taskId,
    setTaskId,
    saveWarning,
    notice,
    clearNotice: () => setNotice(""),
    todaySessions,
    todayMinutes,
    limits: LIMITS[mode],
    canFinish,
    minFinishMins: MIN_FINISH_MINS,
    adjustMins: ADJUST_MINS,
    start,
    pause,
    reset,
    adjust,
    finishEarly,
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
