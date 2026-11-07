import { Router } from "express";
import TimetableEntry from "../models/TimetableEntry.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { assertOwnsSubject } from "../utils/ownership.js";

const router = Router();

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(
      await TimetableEntry.find({ user: req.user._id }).sort({
        day: 1,
        start: 1,
      }),
    );
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { subject, days, start, end, room } = req.body;

    if (!subject) throw httpError(400, "Subject is required");
    if (!Array.isArray(days) || days.length === 0) {
      throw httpError(400, "Select at least one day");
    }
    const uniqueDays = [...new Set(days.map(Number))];
    if (uniqueDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw httpError(
        400,
        "Days must be numbers from 0 (Sunday) to 6 (Saturday)",
      );
    }
    if (!start || !end || end <= start) {
      throw httpError(400, "End time must be after start time");
    }
    await assertOwnsSubject(subject, req.user._id);

    for (const day of uniqueDays) {
      const clash = await TimetableEntry.findOne({
        user: req.user._id,
        day,
        start: { $lt: end },
        end: { $gt: start },
      }).populate("subject", "name");
      if (clash) {
        const name = clash.subject ? clash.subject.name : "another class";
        throw httpError(
          409,
          `Clashes with ${name} on ${DAY_NAMES[day]} (${clash.start} - ${clash.end})`,
        );
      }
    }

    const entries = await TimetableEntry.insertMany(
      uniqueDays.map((day) => ({
        user: req.user._id,
        subject,
        day,
        start,
        end,
        room,
      })),
    );
    res.status(201).json(entries);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const entry = await TimetableEntry.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!entry) return res.status(404).json({ message: "Class not found" });
    res.json({ message: "Class deleted" });
  }),
);

export default router;
