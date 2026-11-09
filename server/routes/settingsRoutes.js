import { Router } from "express";
import UserSettings from "../models/UserSettings.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { getSettings } from "../services/settingsService.js";
import { toMinutes } from "../services/slotScheduler.js";

const router = Router();

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const isTime = (v) => typeof v === "string" && TIME.test(v);
const inRange = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

function validate(body) {
  const {
    dayStart,
    dayEnd,
    minSlotMins,
    maxSlotMins,
    breakMins,
    blockedTimes,
  } = body;

  if (!isTime(dayStart) || !isTime(dayEnd)) {
    throw httpError(400, "Study hours must be in HH:mm format");
  }
  if (toMinutes(dayEnd) - toMinutes(dayStart) < 60) {
    throw httpError(400, "Your study day must be at least 1 hour long");
  }
  if (!inRange(minSlotMins, 15, 120)) {
    throw httpError(400, "Minimum slot must be 15 to 120 minutes");
  }
  if (!inRange(maxSlotMins, 30, 180)) {
    throw httpError(400, "Maximum slot must be 30 to 180 minutes");
  }
  if (maxSlotMins < minSlotMins) {
    throw httpError(
      400,
      "Maximum slot cannot be shorter than the minimum slot",
    );
  }
  if (!inRange(breakMins, 0, 30)) {
    throw httpError(400, "Break must be 0 to 30 minutes");
  }
  if (!Array.isArray(blockedTimes) || blockedTimes.length > 10) {
    throw httpError(400, "You can add up to 10 blocked times");
  }

  const clean = blockedTimes.map((b) => {
    const label = typeof b?.label === "string" ? b.label.trim() : "";
    if (!label || label.length > 40) {
      throw httpError(
        400,
        "Each blocked time needs a name of up to 40 characters",
      );
    }
    if (
      !isTime(b.start) ||
      !isTime(b.end) ||
      toMinutes(b.end) <= toMinutes(b.start)
    ) {
      throw httpError(400, `${label}: end time must be after start time`);
    }
    return { label, start: b.start, end: b.end };
  });

  return {
    dayStart,
    dayEnd,
    minSlotMins,
    maxSlotMins,
    breakMins,
    blockedTimes: clean,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getSettings(req.user._id));
  }),
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const data = validate(req.body);
    await UserSettings.findOneAndUpdate({ user: req.user._id }, data, {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    });
    res.json(await getSettings(req.user._id));
  }),
);

export default router;
