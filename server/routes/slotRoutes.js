import { Router } from "express";
import StudySlot from "../models/StudySlot.js";
import Task from "../models/Task.js";
import TimetableEntry from "../models/TimetableEntry.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { generateSlots } from "../services/slotScheduler.js";
import { getSettings } from "../services/settingsService.js";

const router = Router();

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function validDate(value) {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (!validDate(date)) throw httpError(400, "date must be YYYY-MM-DD");
    res.json(
      await StudySlot.find({ user: req.user._id, date }).sort({ start: 1 }),
    );
  }),
);

router.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const { date, today: todayInput, now } = req.body;

    if (!validDate(date)) throw httpError(400, "date must be YYYY-MM-DD");
    if (todayInput !== undefined && !validDate(todayInput)) {
      throw httpError(400, "today must be YYYY-MM-DD");
    }
    if (now !== undefined && (typeof now !== "string" || !TIME.test(now))) {
      throw httpError(400, "now must be HH:mm");
    }

    // Optional: plan only these tasks. Leaving it out plans every pending task.
    let taskIds = null;
    if (req.body.taskIds !== undefined) {
      const ids = req.body.taskIds;
      if (!Array.isArray(ids))
        throw httpError(400, "taskIds must be a list of task ids");
      if (ids.length === 0)
        throw httpError(400, "Select at least one task to plan");
      if (ids.length > 500) throw httpError(400, "Too many tasks selected");
      if (ids.some((id) => typeof id !== "string" || !OBJECT_ID.test(id))) {
        throw httpError(400, "taskIds must be a list of task ids");
      }
      taskIds = [...new Set(ids)];
    }

    const today = todayInput || utcToday();
    if (date < today) throw httpError(400, "Choose today or a future date");
    const from = date === today && now ? now : null;

    const userId = req.user._id;
    const settings = await getSettings(userId);

    const taskFilter = { user: userId, completed: false };
    if (taskIds) taskFilter._id = { $in: taskIds };

    const [classes, tasks, keptSlots, committedRows] = await Promise.all([
      TimetableEntry.find({ user: userId }).lean(),
      Task.find(taskFilter).lean(),
      StudySlot.find({
        user: userId,
        date,
        status: { $in: ["done", "skipped"] },
      }).lean(),
      StudySlot.aggregate([
        {
          $match: {
            user: userId,
            $or: [
              { status: "done" },
              { status: "planned", date: { $gte: today, $ne: date } },
            ],
          },
        },
        { $group: { _id: "$task", minutes: { $sum: "$minutes" } } },
      ]),
    ]);

    const committed = {};
    for (const row of committedRows) committed[String(row._id)] = row.minutes;

    const result = generateSlots({
      date,
      classes,
      blocked: settings.blockedTimes,
      keptSlots: keptSlots.map((s) => ({ start: s.start, end: s.end })),
      tasks: tasks.map((t) => ({
        id: String(t._id),
        priority: t.priority,
        dueDate: t.dueDate,
        estimatedMins: t.estimatedMins,
        completed: t.completed,
      })),
      committed,
      prefs: {
        dayStart: settings.dayStart,
        dayEnd: settings.dayEnd,
        minSlotMins: settings.minSlotMins,
        maxSlotMins: settings.maxSlotMins,
        breakMins: settings.breakMins,
      },
      from,
    });

    // Replace this day's unfinished plan with the new one.
    await StudySlot.deleteMany({ user: userId, date, status: "planned" });
    if (result.slots.length > 0) {
      await StudySlot.insertMany(
        result.slots.map((s) => ({
          user: userId,
          task: s.task,
          date,
          start: s.start,
          end: s.end,
          minutes: s.minutes,
        })),
      );
    }

    const slots = await StudySlot.find({ user: userId, date }).sort({
      start: 1,
    });
    res.json({
      date,
      slots,
      unscheduled: result.unscheduled,
      freeMinutes: result.freeMinutes,
      plannedMinutes: result.plannedMinutes,
    });
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!["planned", "done", "skipped"].includes(status)) {
      throw httpError(400, "Status must be planned, done or skipped");
    }
    const slot = await StudySlot.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status },
      { new: true },
    );
    if (!slot) return res.status(404).json({ message: "Slot not found" });
    res.json(slot);
  }),
);

export default router;
