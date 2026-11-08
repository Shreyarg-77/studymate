import { Router } from "express";
import PomodoroSession from "../models/PomodoroSession.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { assertOwnsTask } from "../utils/ownership.js";

const router = Router();

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
    const { task, minutes } = req.body;
    const m = Number(minutes);
    if (!Number.isInteger(m) || m < 1 || m > 180) {
      throw httpError(400, "Minutes must be a whole number from 1 to 180");
    }
    await assertOwnsTask(task, req.user._id);
    const session = await PomodoroSession.create({
      user: req.user._id,
      task: task || null,
      minutes: m,
    });
    res.status(201).json(session);
  }),
);

export default router;
