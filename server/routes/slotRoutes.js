import { Router } from "express";
import StudySlot from "../models/StudySlot.js";
import Task from "../models/Task.js";
import TimetableEntry from "../models/TimetableEntry.js";
import PomodoroSession from "../models/PomodoroSession.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { validDate, addDaysToDate } from "../utils/dates.js";
import { generateSlots } from "../services/slotScheduler.js";
import { getSettings } from "../services/settingsService.js";
import { getProgress, completeTask } from "../services/taskProgress.js";

const router = Router();

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const MISSED_LOOKBACK_DAYS = 14;

const utcToday = () => new Date().toISOString().slice(0, 10);

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

router.get(
  "/missed",
  asyncHandler(async (req, res) => {
    const { today } = req.query;
    if (!validDate(today)) throw httpError(400, "today must be YYYY-MM-DD");

    const since = addDaysToDate(today, -MISSED_LOOKBACK_DAYS);
    const slots = await StudySlot.find({
      user: req.user._id,
      status: "planned",
      handled: { $ne: true },
      date: { $gte: since, $lt: today },
    })
      .select("date minutes")
      .lean();

    res.json({
      count: slots.length,
      minutes: slots.reduce((sum, s) => sum + s.minutes, 0),
      earliest: slots.reduce(
        (min, s) => (min === null || s.date < min ? s.date : min),
        null,
      ),
    });
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

    // fill: keep the day's plan as it is and only add what is missing.
    // replan (the default): rebuild the day's unfinished slots.
    const mode = req.body.mode === "fill" ? "fill" : "replan";

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
    const rollNow = now || "00:00";

    const userId = req.user._id;
    const settings = await getSettings(userId);

    const taskFilter = { user: userId, completed: false };
    if (taskIds) taskFilter._id = { $in: taskIds };

    const dayStatuses =
      mode === "fill" ? ["done", "skipped", "planned"] : ["done", "skipped"];

    // Planned slots that still count as covering a task: later days, and the
    // rest of today. A slot whose time has already passed is missed work, so it
    // is not counted and the work moves into this plan.
    const plannedElsewhere = [
      { status: "planned", date: { $gt: today, $ne: date } },
    ];
    if (date !== today) {
      plannedElsewhere.push({
        status: "planned",
        date: today,
        end: { $gt: rollNow },
      });
    }

    const [classes, tasks, dayDocs, slotRows, focusRows] = await Promise.all([
      TimetableEntry.find({ user: userId }).lean(),
      Task.find(taskFilter).lean(),
      StudySlot.find({
        user: userId,
        date,
        status: { $in: dayStatuses },
      }).lean(),
      StudySlot.aggregate([
        {
          $match: {
            user: userId,
            $or: [{ status: "done" }, ...plannedElsewhere],
          },
        },
        {
          $group: {
            _id: { task: "$task", status: "$status" },
            minutes: { $sum: "$minutes" },
          },
        },
      ]),
      PomodoroSession.aggregate([
        { $match: { user: userId, task: { $ne: null } } },
        { $group: { _id: "$task", minutes: { $sum: "$minutes" } } },
      ]),
    ]);

    const done = {};
    const elsewhere = {};
    const focus = {};
    const sameDay = {};
    for (const row of slotRows) {
      const id = String(row._id.task);
      if (row._id.status === "done") done[id] = row.minutes;
      else elsewhere[id] = row.minutes;
    }
    for (const row of focusRows) focus[String(row._id)] = row.minutes;
    for (const s of dayDocs) {
      if (s.status === "planned") {
        sameDay[String(s.task)] = (sameDay[String(s.task)] || 0) + s.minutes;
      }
    }

    // Effort counts once (done slots or focus time, whichever is larger).
    const committed = {};
    const allIds = new Set([
      ...Object.keys(done),
      ...Object.keys(elsewhere),
      ...Object.keys(focus),
      ...Object.keys(sameDay),
    ]);
    for (const id of allIds) {
      committed[id] =
        Math.max(done[id] || 0, focus[id] || 0) +
        (elsewhere[id] || 0) +
        (sameDay[id] || 0);
    }

    const result = generateSlots({
      date,
      classes,
      blocked: settings.blockedTimes,
      keptSlots: dayDocs.map((s) => ({
        start: s.start,
        end: s.end,
        task: String(s.task),
        minutes: s.minutes,
      })),
      tasks: tasks.map((t) => ({
        id: String(t._id),
        priority: t.priority,
        dueDate: t.dueDate,
        estimatedMins: t.estimatedMins,
        dailyMins: t.dailyMins,
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

    // Missed work that is now part of a plan no longer needs a warning.
    const rolled = [{ date: { $lt: today } }];
    if (date > today && now) rolled.push({ date: today, end: { $lte: now } });
    await StudySlot.updateMany(
      {
        user: userId,
        status: "planned",
        handled: { $ne: true },
        task: { $in: tasks.map((t) => t._id) },
        $or: rolled,
      },
      { handled: true },
    );

    if (mode === "replan") {
      await StudySlot.deleteMany({ user: userId, date, status: "planned" });
    }
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
      mode,
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
    const { status, today: todayInput } = req.body;
    if (!["planned", "done", "skipped"].includes(status)) {
      throw httpError(400, "Status must be planned, done or skipped");
    }
    if (todayInput !== undefined && !validDate(todayInput)) {
      throw httpError(400, "today must be YYYY-MM-DD");
    }
    const slot = await StudySlot.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status },
      { new: true },
    );
    if (!slot) return res.status(404).json({ message: "Slot not found" });

    let task = await Task.findOne({
      _id: slot.task,
      user: req.user._id,
    }).lean();
    let progress = null;

    if (task) {
      progress = await getProgress(req.user._id, task, todayInput);

      // Finished: nothing else is planned for it, or all of its time is done.
      if (
        status === "done" &&
        !task.completed &&
        (progress.plannedLeft === 0 ||
          progress.doneMinutes >= progress.estimate)
      ) {
        task = await completeTask(req.user._id, task);
        progress.plannedLeft = 0;
      } else if (
        status !== "done" &&
        task.completed &&
        task.autoCompleted &&
        progress.doneMinutes < progress.estimate
      ) {
        // Undo: a task that finished by itself reopens. Manual completion is never undone.
        task = await Task.findOneAndUpdate(
          { _id: task._id, user: req.user._id },
          { completed: false, completedAt: null, autoCompleted: false },
          { new: true },
        ).lean();
      }
    }

    res.json({ ...slot.toObject(), updatedTask: task || null, progress });
  }),
);

export default router;
