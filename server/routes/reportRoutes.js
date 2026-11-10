import { Router } from "express";
import StudySlot from "../models/StudySlot.js";
import Task from "../models/Task.js";
import PomodoroSession from "../models/PomodoroSession.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { validDate, addDaysToDate } from "../utils/dates.js";
import { taskScore } from "../services/slotScheduler.js";

const router = Router();
const HOUR = 60 * 60 * 1000;

const brief = (t) => ({
  _id: t._id,
  title: t.title,
  subject: t.subject,
  priority: t.priority,
  dueDate: t.dueDate,
  estimatedMins: t.estimatedMins,
  completedAt: t.completedAt,
});

function totalsOf(slots) {
  const totals = {
    planned: { count: 0, minutes: 0 },
    done: { count: 0, minutes: 0 },
    skipped: { count: 0, minutes: 0 },
  };
  for (const s of slots) {
    totals[s.status].count += 1;
    totals[s.status].minutes += s.minutes;
  }
  return totals;
}

/*
 * The browser sends the start and end of ITS local day as timestamps, because
 * the server runs in UTC and cannot know the user's time zone.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { date, from, to } = req.query;
    if (!validDate(date)) throw httpError(400, "date must be YYYY-MM-DD");

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw httpError(400, "from and to must be ISO timestamps");
    }
    const span = toDate.getTime() - fromDate.getTime();
    if (span < 20 * HOUR || span > 28 * HOUR) {
      throw httpError(400, "from and to must cover exactly one day");
    }

    const userId = req.user._id;
    const nextDate = addDaysToDate(date, 1);

    const [slots, completed, openTasks, sessions, nextSlots] =
      await Promise.all([
        StudySlot.find({ user: userId, date }).sort({ start: 1 }).lean(),
        Task.find({
          user: userId,
          completedAt: { $gte: fromDate, $lt: toDate },
        })
          .sort({ completedAt: 1 })
          .lean(),
        // What was still open at the END of that day.
        Task.find({
          user: userId,
          createdAt: { $lt: toDate },
          $or: [{ completed: false }, { completedAt: { $gte: toDate } }],
        }).lean(),
        PomodoroSession.find({
          user: userId,
          completedAt: { $gte: fromDate, $lt: toDate },
        }).lean(),
        StudySlot.find({
          user: userId,
          date: nextDate,
          status: "planned",
        }).lean(),
      ]);

    const dueTasks = openTasks.filter((t) => t.dueDate === date);
    const overdueTasks = openTasks
      .filter((t) => t.dueDate && t.dueDate < date)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const topTasks = [...openTasks]
      .sort((a, b) => taskScore(b, nextDate) - taskScore(a, nextDate))
      .slice(0, 3);

    res.json({
      date,
      totals: totalsOf(slots),
      slots: slots.map((s) => ({
        _id: s._id,
        task: s.task,
        start: s.start,
        end: s.end,
        minutes: s.minutes,
        status: s.status,
      })),
      completedTasks: completed.map(brief),
      focus: {
        sessions: sessions.length,
        minutes: sessions.reduce((sum, s) => sum + s.minutes, 0),
      },
      dueTasks: dueTasks.map(brief),
      overdueTasks: overdueTasks.map(brief),
      next: {
        date: nextDate,
        plannedCount: nextSlots.length,
        plannedMinutes: nextSlots.reduce((sum, s) => sum + s.minutes, 0),
        topTasks: topTasks.map(brief),
      },
    });
  }),
);

export default router;
