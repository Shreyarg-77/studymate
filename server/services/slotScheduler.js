/*
 * Study slot scheduler (pure functions: no database, no Express).
 *
 * Times are "HH:mm" strings and are handled internally as minutes since
 * midnight. Dates are "YYYY-MM-DD" strings. Weekdays use JavaScript numbering
 * (0 = Sunday ... 6 = Saturday), the same as the timetable.
 */

export const DEFAULT_PREFS = {
  dayStart: "08:00",
  dayEnd: "22:00",
  minSlotMins: 30,
  maxSlotMins: 90,
  breakMins: 10,
};

const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 };
const DEFAULT_ESTIMATE = 60;
const MIN_FINAL_CHUNK = 5; // the last piece of a task may be shorter than minSlotMins
const PREFERRED_TAIL = 15; // when splitting a task, avoid leaving a smaller leftover than this
const ROUND_TO = 5; // "from" times are rounded up to the next 5 minutes

export function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function toTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// Computed in UTC so the result never depends on the server's time zone.
export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function dayNumber(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Same idea as the score on the Tasks page, but measured from the planned
// date instead of from today.
export function taskScore(task, dateStr) {
  const base = (PRIORITY_WEIGHT[task.priority] || 2) * 10;
  if (!task.dueDate) return base;
  const left = dayNumber(task.dueDate) - dayNumber(dateStr);
  if (left < 0) return base + 25;
  return base + 10 / Math.max(left, 0.5);
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const i of sorted) {
    const last = merged[merged.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else merged.push({ start: i.start, end: i.end });
  }
  return merged;
}

// Free time inside [windowStart, windowEnd] that is not covered by "busy",
// keeping only gaps of at least minGap minutes.
export function findFreeGaps(windowStart, windowEnd, busy, minGap) {
  const gaps = [];
  let cursor = windowStart;
  for (const b of mergeIntervals(busy)) {
    if (b.end <= cursor) continue;
    if (b.start >= windowEnd) break;
    if (b.start - cursor >= minGap) gaps.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (windowEnd - cursor >= minGap)
    gaps.push({ start: cursor, end: windowEnd });
  return gaps;
}

/*
 * date       "YYYY-MM-DD" day to plan
 * classes    timetable entries: { day, start, end }
 * keptSlots  slots already fixed for this date (done or skipped): { start, end }
 *            their time counts as busy, so they are never overwritten
 * tasks      { id, priority, dueDate, estimatedMins, completed }
 * committed  { [taskId]: minutes } already done, or planned on other days
 * prefs      overrides for DEFAULT_PREFS
 * from       "HH:mm" local time, only used when planning today
 *
 * Returns { slots, unscheduled, freeMinutes, plannedMinutes }.
 */
export function generateSlots({
  date,
  classes = [],
  blocked = [],
  keptSlots = [],
  tasks = [],
  committed = {},
  prefs = {},
  from = null,
}) {
  const p = { ...DEFAULT_PREFS, ...prefs };
  const weekday = weekdayOf(date);

  let windowStart = toMinutes(p.dayStart);
  const windowEnd = toMinutes(p.dayEnd);
  if (from) {
    const rounded = Math.ceil(toMinutes(from) / ROUND_TO) * ROUND_TO;
    windowStart = Math.max(windowStart, rounded);
  }

  const busy = [
    ...classes
      .filter((c) => c.day === weekday)
      .map((c) => ({ start: toMinutes(c.start), end: toMinutes(c.end) })),
    ...blocked.map((b) => ({
      start: toMinutes(b.start),
      end: toMinutes(b.end),
    })),
    ...keptSlots.map((s) => ({
      start: toMinutes(s.start),
      end: toMinutes(s.end),
    })),
  ];

  const gaps = findFreeGaps(windowStart, windowEnd, busy, p.minSlotMins);
  const freeMinutes = gaps.reduce((sum, g) => sum + (g.end - g.start), 0);

  const queue = tasks
    .filter((t) => !t.completed)
    .map((t) => ({
      id: t.id,
      score: taskScore(t, date),
      remaining: (t.estimatedMins || DEFAULT_ESTIMATE) - (committed[t.id] || 0),
    }))
    .filter((t) => t.remaining > 0)
    .sort((a, b) => b.score - a.score);

  const slots = [];

  for (const gap of gaps) {
    let cursor = gap.start;
    for (;;) {
      const room = gap.end - cursor;
      let placed = false;

      for (const t of queue) {
        if (t.remaining <= 0) continue;
        let chunk = Math.min(t.remaining, p.maxSlotMins, room);
        // When splitting, shrink this piece a little so the leftover is not tiny.
        if (chunk < t.remaining && t.remaining - chunk < PREFERRED_TAIL) {
          const trimmed = t.remaining - PREFERRED_TAIL;
          if (trimmed >= p.minSlotMins) chunk = trimmed;
        }
        const finishes = chunk === t.remaining;
        const valid =
          chunk >= p.minSlotMins || (finishes && chunk >= MIN_FINAL_CHUNK);
        if (!valid) continue;

        slots.push({
          task: t.id,
          start: toTime(cursor),
          end: toTime(cursor + chunk),
          minutes: chunk,
        });
        t.remaining -= chunk;
        cursor += chunk + p.breakMins;
        placed = true;
        break;
      }

      if (!placed) break;
    }
  }

  const unscheduled = queue
    .filter((t) => t.remaining > 0)
    .map((t) => ({ task: t.id, minutes: t.remaining }));

  const plannedMinutes = slots.reduce((sum, s) => sum + s.minutes, 0);

  return { slots, unscheduled, freeMinutes, plannedMinutes };
}
