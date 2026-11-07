import { Router } from "express";
import Subject from "../models/Subject.js";
import Task from "../models/Task.js";
import TimetableEntry from "../models/TimetableEntry.js";
import Note from "../models/Note.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await Subject.find().sort({ createdAt: 1 }));
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, type, color } = req.body;
    const subject = await Subject.create({ name, type, color });
    res.status(201).json(subject);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    await Task.deleteMany({ subject: subject._id });
    await TimetableEntry.deleteMany({ subject: subject._id });
    await Note.updateMany(
      { subject: subject._id },
      { subject: null, task: null },
    );
    res.json({ message: "Subject and its related data deleted" });
  }),
);

export default router;
