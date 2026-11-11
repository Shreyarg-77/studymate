import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { addDays, format, startOfDay } from "date-fns";
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

  const [settings, setSettings] = useState(null);
  const [card, setCard] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const tasksRef = useRef(tasks);
  const timetableRef = useRef(timetable);
  const slotsRef = useRef([]);
  const busyRef = useRef(false);
  const shownRef = useRef(false);

  useEffect(() => {
    tasksRef.current = tasks;
    timetableRef.current = timetable;
  });

  // Load the reminder settings, and pick up changes made on the Settings page.
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

  const briefingOn = Boolean(settings?.briefingEnabled);
  const briefingTime = settings?.briefingTime;
  const slotRemindersOn = Boolean(settings?.slotRemindersEnabled);
  const leadMins = settings?.slotReminderLeadMins ?? 10;

  // Morning briefing: once a day, the first time the app is open after the set time.
  useEffect(() => {
    if (!briefingOn || !briefingTime || loading || !userId) return;
    const key = `studymate-briefing-${userId}`;
    let cancelled = false;

    async function load(notify) {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const today = todayStr();
        const start = startOfDay(new Date());
        const res = await api.get("/report", {
          params: {
            date: today,
            from: start.toISOString(),
            to: addDays(start, 1).toISOString(),
          },
        });
        if (cancelled) return;

        const nowTime = timeStr();
        const slots = res.data.slots
          .filter((s) => s.status === "planned" && s.end > nowTime)
          .map((s) => {
            const task = tasksRef.current.find((t) => t._id === s.task);
            return {
              id: s._id,
              start: s.start,
              end: s.end,
              title: task ? task.title : "Study session",
            };
          });
        const due = res.data.dueTasks.map((t) => t.title);
        const overdue = res.data.overdueTasks.length;
        const empty = slots.length === 0 && due.length === 0 && overdue === 0;

        writeJson(key, { date: today, dismissed: empty });
        if (empty) {
          setCard(null);
          return;
        }

        shownRef.current = true;
        setCard({ date: today, slots, due, overdue });
        if (notify) {
          const parts = [];
          if (slots.length) parts.push(`${slots.length} study slot(s)`);
          if (due.length) parts.push(`${due.length} task(s) due today`);
          if (overdue) parts.push(`${overdue} overdue`);
          showNotification("StudyMate: today at a glance", parts.join(", "));
        }
      } catch {
        // the server may still be waking up, so the next check tries again
      } finally {
        busyRef.current = false;
      }
    }

    function check() {
      const today = todayStr();
      const stored = readJson(key, {});
      if (stored.date === today) {
        if (!stored.dismissed && !shownRef.current) load(false);
        return;
      }
      shownRef.current = false;
      setCard((prev) => (prev && prev.date !== today ? null : prev));
      if (timeStr() >= briefingTime) load(true);
    }

    const first = setTimeout(check, 0);
    const timer = setInterval(check, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [briefingOn, briefingTime, loading, userId]);

  // Slot reminders: shortly before a planned slot starts, never during a class.
  useEffect(() => {
    if (!slotRemindersOn || loading || !userId) return;
    const key = `studymate-reminded-${userId}`;
    let cancelled = false;

    async function refresh() {
      try {
        const res = await api.get("/slots", { params: { date: todayStr() } });
        if (!cancelled) slotsRef.current = res.data;
      } catch {
        // keep the previous list
      }
    }

    function tick() {
      if (cancelled) return;
      const now = new Date();
      const today = format(now, "yyyy-MM-dd");
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const weekday = now.getDay();

      const inClass = timetableRef.current.some(
        (c) =>
          c.day === weekday &&
          toMin(c.start) <= nowMin &&
          nowMin < toMin(c.end),
      );
      if (inClass) return;

      const stored = readJson(key, {});
      const reminded = stored.date === today ? stored.ids || [] : [];

      for (const s of slotsRef.current) {
        if (
          s.date !== today ||
          s.status !== "planned" ||
          reminded.includes(s._id)
        ) {
          continue;
        }
        const startMin = toMin(s.start);
        if (startMin - leadMins <= nowMin && nowMin < startMin) {
          const task = tasksRef.current.find((t) => t._id === s.task);
          const text = `${task ? task.title : "Study session"} starts at ${s.start}`;
          showNotification("StudyMate: study slot soon", text);
          setAlerts((prev) => [...prev, { id: s._id, text }]);
          setTimeout(
            () => setAlerts((prev) => prev.filter((a) => a.id !== s._id)),
            120000,
          );
          reminded.push(s._id);
          writeJson(key, { date: today, ids: reminded });
        }
      }
    }

    refresh().then(tick);
    const refreshTimer = setInterval(refresh, 120000);
    const tickTimer = setInterval(tick, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh().then(tick);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
      clearInterval(tickTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slotRemindersOn, leadMins, loading, userId]);

  const showCard = briefingOn && card;
  if (!showCard && alerts.length === 0) return null;

  function dismissCard() {
    writeJson(`studymate-briefing-${userId}`, {
      date: card.date,
      dismissed: true,
    });
    setCard(null);
  }

  return (
    <div className="mx-auto mb-4 flex max-w-2xl flex-col gap-2">
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

          {card.slots.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-indigo-800">Study slots</p>
              <ul className="text-sm text-indigo-900">
                {card.slots.map((s) => (
                  <li key={s.id}>
                    {s.start} - {s.end} · {s.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {card.due.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-indigo-800">Due today</p>
              <ul className="text-sm text-indigo-900">
                {card.due.map((title, i) => (
                  <li key={`${title}-${i}`}>{title}</li>
                ))}
              </ul>
            </div>
          )}

          {card.overdue > 0 && (
            <p className="mb-2 text-sm font-medium text-red-700">
              {card.overdue} overdue task{card.overdue === 1 ? "" : "s"}
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
