import { Router } from "express";
import Note from "../models/Note.js";
import asyncHandler from "../utils/asyncHandler.js";
import { assertOwnsSubject, assertOwnsTask } from "../utils/ownership.js";

const router = Router();

const ALLOWED = ["title", "content", "subject", "task", "pinned"];

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(
      await Note.find({ user: req.user._id }).sort({
        pinned: -1,
        updatedAt: -1,
      }),
    );
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title, content, subject, task } = req.body;
    await assertOwnsSubject(subject, req.user._id);
    await assertOwnsTask(task, req.user._id);
    const note = await Note.create({
      user: req.user._id,
      title,
      content,
      subject,
      task,
    });
    res.status(201).json(note);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const updates = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    await assertOwnsSubject(updates.subject, req.user._id);
    await assertOwnsTask(updates.task, req.user._id);

    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true },
    );
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.json(note);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.json({ message: "Note deleted" });
  }),
);

export default router;
