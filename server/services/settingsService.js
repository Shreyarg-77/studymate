import UserSettings from "../models/UserSettings.js";
import { DEFAULT_PREFS } from "./slotScheduler.js";

export async function getSettings(userId) {
  const doc = await UserSettings.findOne({ user: userId }).lean();
  return {
    dayStart: doc?.dayStart ?? DEFAULT_PREFS.dayStart,
    dayEnd: doc?.dayEnd ?? DEFAULT_PREFS.dayEnd,
    minSlotMins: doc?.minSlotMins ?? DEFAULT_PREFS.minSlotMins,
    maxSlotMins: doc?.maxSlotMins ?? DEFAULT_PREFS.maxSlotMins,
    breakMins: doc?.breakMins ?? DEFAULT_PREFS.breakMins,
    blockedTimes: (doc?.blockedTimes ?? []).map((b) => ({
      _id: b._id,
      label: b.label,
      start: b.start,
      end: b.end,
    })),
  };
}
