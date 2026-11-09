import { Router } from "express";
import StudySlot from "../models/StudySlot.js";
import Task from "../models/Task.js";
import TimetableEntry from "../models/TimetableEntry.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { generateSlots } from "../services/slotScheduler.js";

const router = Router();

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

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

    const today = todayInput || utcToday();
    if (date < today) throw httpError(400, "Choose today or a future date");
    const from = date === today && now ? now : null;

    const userId = req.user._id;

    // Planned slots from days that have already passed are stale.
    await StudySlot.deleteMany({
      user: userId,
      status: "planned",
      date: { $lt: today },
    });

    const [classes, tasks, keptSlots, committedRows] = await Promise.all([
      TimetableEntry.find({ user: userId }).lean(),
      Task.find({ user: userId, completed: false }).lean(),
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
      keptSlots: keptSlots.map((s) => ({ start: s.start, end: s.end })),
      tasks: tasks.map((t) => ({
        id: String(t._id),
        priority: t.priority,
        dueDate: t.dueDate,
        estimatedMins: t.estimatedMins,
        completed: t.completed,
      })),
      committed,
      from,
    });

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
