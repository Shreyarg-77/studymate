import { Router } from "express";
import Task from "../models/Task.js";
import Note from "../models/Note.js";
import StudySlot from "../models/StudySlot.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { assertOwnsSubject } from "../utils/ownership.js";

const router = Router();

const ALLOWED = [
  "title",
  "subject",
  "category",
  "dueDate",
  "priority",
  "estimatedMins",
  "completed",
];

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await Task.find({ user: req.user._id }).sort({ createdAt: -1 }));
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title, subject, category, dueDate, priority, estimatedMins } =
      req.body;
    if (!subject) throw httpError(400, "Subject is required");
    await assertOwnsSubject(subject, req.user._id);
    const task = await Task.create({
      user: req.user._id,
      title,
      subject,
      category,
      dueDate,
      priority,
      estimatedMins,
    });
    res.status(201).json(task);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const updates = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (
      updates.completed !== undefined &&
      typeof updates.completed !== "boolean"
    ) {
      throw httpError(400, "completed must be true or false");
    }
    if (updates.subject) await assertOwnsSubject(updates.subject, req.user._id);

    const existing = await Task.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).select("completed");
    if (!existing) return res.status(404).json({ message: "Task not found" });

    if (updates.completed === true && !existing.completed) {
      updates.completedAt = new Date();
    }
    if (updates.completed === false) {
      updates.completedAt = null;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true },
    );
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (updates.completed === true) {
      await StudySlot.deleteMany({
        task: task._id,
        user: req.user._id,
        status: "planned",
      });
    }
    res.json(task);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!task) return res.status(404).json({ message: "Task not found" });
    await Note.updateMany(
      { task: task._id, user: req.user._id },
      { task: null },
    );
    await StudySlot.deleteMany({ task: task._id, user: req.user._id });
    res.json({ message: "Task deleted" });
  }),
);

export default router;
