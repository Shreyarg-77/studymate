import { Router } from "express";
import Subject from "../models/Subject.js";
import Task from "../models/Task.js";
import TimetableEntry from "../models/TimetableEntry.js";
import Note from "../models/Note.js";
import StudySlot from "../models/StudySlot.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await Subject.find({ user: req.user._id }).sort({ createdAt: 1 }));
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, type, color } = req.body;
    const subject = await Subject.create({
      user: req.user._id,
      name,
      type,
      color,
    });
    res.status(201).json(subject);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const subject = await Subject.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    const taskIds = await Task.distinct("_id", {
      subject: subject._id,
      user: req.user._id,
    });
    await StudySlot.deleteMany({ user: req.user._id, task: { $in: taskIds } });
    await Task.deleteMany({ subject: subject._id, user: req.user._id });
    await TimetableEntry.deleteMany({
      subject: subject._id,
      user: req.user._id,
    });
    await Note.updateMany(
      { subject: subject._id, user: req.user._id },
      { subject: null, task: null },
    );
    res.json({ message: "Subject and its related data deleted" });
  }),
);

export default router;
