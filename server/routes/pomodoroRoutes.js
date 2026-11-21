import { Router } from "express";
import PomodoroSession from "../models/PomodoroSession.js";
import Task from "../models/Task.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { validDate } from "../utils/dates.js";
import { assertOwnsTask } from "../utils/ownership.js";
import {
  getProgress,
  completeTask,
  trimPlanned,
} from "../services/taskProgress.js";

const router = Router();

const utcToday = () => new Date().toISOString().slice(0, 10);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    res.json(
      await PomodoroSession.find({
        user: req.user._id,
        completedAt: { $gte: since },
      }).sort({ completedAt: 1 }),
    );
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { task: taskId, minutes, today: todayInput } = req.body;
    const m = Number(minutes);
    if (!Number.isInteger(m) || m < 1 || m > 180) {
      throw httpError(400, "Minutes must be a whole number from 1 to 180");
    }
    if (todayInput !== undefined && !validDate(todayInput)) {
      throw httpError(400, "today must be YYYY-MM-DD");
    }
    await assertOwnsTask(taskId, req.user._id);

    const session = await PomodoroSession.create({
      user: req.user._id,
      task: taskId || null,
      minutes: m,
    });

    let updatedTask = null;
    let progress = null;
    if (taskId) {
      const task = await Task.findOne({
        _id: taskId,
        user: req.user._id,
      }).lean();
      if (task && !task.completed) {
        const today = todayInput || utcToday();
        progress = await getProgress(req.user._id, task, today);
        if (progress.doneMinutes >= progress.estimate) {
          updatedTask = await completeTask(req.user._id, task);
        } else {
          await trimPlanned(req.user._id, task, progress, today);
        }
      }
    }

    res.status(201).json({ ...session.toObject(), updatedTask, progress });
  }),
);

export default router;
