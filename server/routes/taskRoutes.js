import { Router } from "express";
import Task from "../models/Task.js";
import Note from "../models/Note.js";
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
    if (updates.subject) await assertOwnsSubject(updates.subject, req.user._id);

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true },
    );
    if (!task) return res.status(404).json({ message: "Task not found" });
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
    res.json({ message: "Task deleted" });
  }),
);

export default router;
