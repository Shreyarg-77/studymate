import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const timeStr = () => format(new Date(), "HH:mm");
const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be unavailable
  }
}

function showNotification(title, body) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    // some mobile browsers do not allow this constructor
  }
}

function Reminders() {
  const { user } = useAuth();
  const { tasks, timetable, loading } = useData();
  const userId = user?.id;
  const briefingKey = `studymate-briefing-${userId}`;
  const remindedKey = `studymate-reminded-${userId}`;

  const [settings, setSettings] = useState(null);
  const [todaySlots, setTodaySlots] = useState(null);
  const [briefing, setBriefing] = useState(() => readJson(briefingKey, {}));
  const [alerts, setAlerts] = useState([]);
  const [, setMinute] = useState(0);

  const tasksRef = useRef(tasks);
  const timetableRef = useRef(timetable);
  const slotsRef = useRef([]);

  useEffect(() => {
    tasksRef.current = tasks;
    timetableRef.current = timetable;
    slotsRef.current = todaySlots || [];
  });

  // Reminder settings, including changes made on the Settings page.
  useEffect(() => {
    let cancelled = false;
    api
      .get("/settings")
      .then((res) => {
        if (!cancelled) setSettings(res.data);
      })
      .catch(() => {});
    function onChange(e) {
      setSettings(e.detail);
    }
    window.addEventListener("studymate-settings-changed", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("studymate-settings-changed", onChange);
    };
  }, []);

  // Today's study slots, refreshed after any change and when the tab is shown again.
  useEffect(() => {
    if (loading || !userId) return undefined;
    let cancelled = false;
    let timer = null;
    function load() {
      api
        .get("/slots", { params: { date: todayStr() } })
        .then((res) => {
          if (!cancelled) setTodaySlots(res.data);
        })
        .catch(() => {});
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(load, 400);
    }
    function onVisible() {
      if (document.visibilityState === "visible") schedule();
    }
    const first = setTimeout(load, 0);
    const interval = setInterval(load, 120000);
    window.addEventListener("studymate-data-changed", schedule);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("studymate-data-changed", schedule);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loading, userId]);

  // Re-draw once a minute so slots whose time has passed drop out of the card.
  useEffect(() => {
    const id = setInterval(() => setMinute((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const briefingOn = Boolean(settings?.briefingEnabled);
  const briefingTime = settings?.briefingTime;
  const slotRemindersOn = Boolean(settings?.slotRemindersEnabled);
  const leadMins = settings?.slotReminderLeadMins ?? 10;

  // Morning briefing: becomes visible once a day, after the chosen time.
  useEffect(() => {
    if (!briefingOn || !briefingTime || !userId) return undefined;
    function check() {
      const today = todayStr();
      setBriefing((prev) => {
        if (prev.date === today || timeStr() < briefingTime) return prev;
        const next = { date: today, dismissed: false, notified: false };
        writeJson(briefingKey, next);
        return next;
      });
    }
    const first = setTimeout(check, 0);
    const timer = setInterval(check, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [briefingOn, briefingTime, userId, briefingKey]);

  // What the card shows is worked out from live data.
  const today = todayStr();
  const nowTime = timeStr();
  const open = tasks.filter((t) => !t.completed);
  const slotItems = (todaySlots || [])
    .filter((s) => s.status === "planned" && s.end > nowTime)
    .map((s) => ({ s, task: open.find((t) => t._id === s.task) }))
    .filter((x) => x.task)
    .map(({ s, task }) => ({
      id: s._id,
      start: s.start,
      end: s.end,
      title: task.title,
    }));
  const dueToday = open.filter((t) => t.dueDate === today);
  const overdueCount = open.filter(
    (t) => t.dueDate && t.dueDate < today,
  ).length;
  const slotCount = slotItems.length;
  const dueCount = dueToday.length;
  const hasContent = slotCount + dueCount + overdueCount > 0;
  const showCard =
    briefingOn && briefing.date === today && !briefing.dismissed && hasContent;

  // One system notification per day.
  useEffect(() => {
    if (!showCard || todaySlots === null) return;
    const stored = readJson(briefingKey, {});
    if (stored.notified) return;
    const parts = [];
    if (slotCount) parts.push(`${slotCount} study slot(s)`);
    if (dueCount) parts.push(`${dueCount} task(s) due today`);
    if (overdueCount) parts.push(`${overdueCount} overdue`);
    showNotification("StudyMate: today at a glance", parts.join(", "));
    writeJson(briefingKey, { ...stored, notified: true });
  }, [showCard, todaySlots, slotCount, dueCount, overdueCount, briefingKey]);

  // Slot reminders: shortly before a planned slot starts, never during a class.
  useEffect(() => {
    if (!slotRemindersOn || loading || !userId) return undefined;

    function tick() {
      const now = new Date();
      const day = format(now, "yyyy-MM-dd");
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const weekday = now.getDay();

      const inClass = timetableRef.current.some(
        (c) =>
          c.day === weekday &&
          toMin(c.start) <= nowMin &&
          nowMin < toMin(c.end),
      );
      if (inClass) return;

      const stored = readJson(remindedKey, {});
      const reminded = stored.date === day ? stored.ids || [] : [];

      for (const s of slotsRef.current) {
        if (
          s.date !== day ||
          s.status !== "planned" ||
          reminded.includes(s._id)
        ) {
          continue;
        }
        const task = tasksRef.current.find(
          (t) => t._id === s.task && !t.completed,
        );
        if (!task) continue;
        const startMin = toMin(s.start);
        if (startMin - leadMins <= nowMin && nowMin < startMin) {
          const text = `${task.title} starts at ${s.start}`;
          showNotification("StudyMate: study slot soon", text);
          setAlerts((prev) => [...prev, { id: s._id, text }]);
          setTimeout(
            () => setAlerts((prev) => prev.filter((a) => a.id !== s._id)),
            120000,
          );
          reminded.push(s._id);
          writeJson(remindedKey, { date: day, ids: reminded });
        }
      }
    }

    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [slotRemindersOn, leadMins, loading, userId, remindedKey]);

  if (!showCard && alerts.length === 0) return null;

  function dismissCard() {
    const stored = readJson(briefingKey, {});
    const next = { ...stored, date: today, dismissed: true };
    writeJson(briefingKey, next);
    setBriefing(next);
  }

  return (
    <div className="mx-auto mb-4 flex max-w-3xl flex-col gap-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <span>{a.text}</span>
          <button
            onClick={() =>
              setAlerts((prev) => prev.filter((x) => x.id !== a.id))
            }
            className="text-amber-700 hover:text-amber-900"
            aria-label="Close reminder"
          >
            ×
          </button>
        </div>
      ))}

      {showCard && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-indigo-900">
                Today at a glance
              </p>
              <p className="text-xs text-indigo-700">
                {format(new Date(), "EEEE, d MMMM")}
              </p>
            </div>
            <button
              onClick={dismissCard}
              className="text-sm text-indigo-700 hover:text-indigo-900"
            >
              Dismiss
            </button>
          </div>

          {slotItems.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-indigo-800">
                Study slots to go
              </p>
              <ul className="text-sm text-indigo-900">
                {slotItems.map((s) => (
                  <li key={s.id}>
                    {s.start} - {s.end} · {s.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dueToday.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-indigo-800">Due today</p>
              <ul className="text-sm text-indigo-900">
                {dueToday.map((t) => (
                  <li key={t._id}>{t.title}</li>
                ))}
              </ul>
            </div>
          )}

          {overdueCount > 0 && (
            <p className="mb-2 text-sm font-medium text-red-700">
              {overdueCount} overdue task{overdueCount === 1 ? "" : "s"}
            </p>
          )}

          <div className="flex gap-4 text-sm">
            <Link to="/plan" className="font-medium text-indigo-700 underline">
              Open plan
            </Link>
            <Link
              to="/report"
              className="font-medium text-indigo-700 underline"
            >
              Open report
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reminders;
