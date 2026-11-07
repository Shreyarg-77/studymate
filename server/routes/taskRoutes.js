import { Router } from "express";
import Task from "../models/Task.js";
import asyncHandler from "../utils/asyncHandler.js";
import Note from "../models/Note.js";

const router = Router();

const ALLOWED = [
  "title",
  "subject",
  "category",
  "dueDate",
  "priority",
  "completed",
];

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await Task.find().sort({ createdAt: -1 }));
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title, subject, category, dueDate, priority } = req.body;
    const task = await Task.create({
      title,
      subject,
      category,
      dueDate,
      priority,
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
    const task = await Task.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    await Note.updateMany({ task: task._id }, { task: null });
    res.json({ message: "Task deleted" });
  }),
);

export default router;
