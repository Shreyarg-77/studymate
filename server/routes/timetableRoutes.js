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
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

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

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { day, start, end, room } = req.body;

    const d = Number(day);
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw httpError(
        400,
        "Day must be a number from 0 (Sunday) to 6 (Saturday)",
      );
    }
    if (
      typeof start !== "string" ||
      !TIME.test(start) ||
      typeof end !== "string" ||
      !TIME.test(end)
    ) {
      throw httpError(400, "Times must be in HH:mm format");
    }
    if (end <= start) throw httpError(400, "End time must be after start time");

    const entry = await TimetableEntry.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!entry) return res.status(404).json({ message: "Class not found" });

    const clash = await TimetableEntry.findOne({
      user: req.user._id,
      _id: { $ne: entry._id },
      day: d,
      start: { $lt: end },
      end: { $gt: start },
    }).populate("subject", "name");
    if (clash) {
      const name = clash.subject ? clash.subject.name : "another class";
      throw httpError(
        409,
        `Clashes with ${name} on ${DAY_NAMES[d]} (${clash.start} - ${clash.end})`,
      );
    }

    entry.day = d;
    entry.start = start;
    entry.end = end;
    entry.room = typeof room === "string" ? room.trim() : "";
    await entry.save();
    res.json(entry);
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
