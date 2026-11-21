import Task from "../models/Task.js";
import StudySlot from "../models/StudySlot.js";
import PomodoroSession from "../models/PomodoroSession.js";

// The same effort is never counted twice: use the larger of the minutes in
// done study slots and the minutes in focus sessions linked to the task.
export async function getProgress(userId, task, today) {
  const plannedMatch = { status: "planned" };
  if (today) plannedMatch.date = { $gte: today };

  const [slotRows, focusRows] = await Promise.all([
    StudySlot.aggregate([
      {
        $match: {
          user: userId,
          task: task._id,
          $or: [{ status: "done" }, plannedMatch],
        },
      },
      {
        $group: {
          _id: "$status",
          minutes: { $sum: "$minutes" },
          count: { $sum: 1 },
        },
      },
    ]),
    PomodoroSession.aggregate([
      { $match: { user: userId, task: task._id } },
      { $group: { _id: null, minutes: { $sum: "$minutes" } } },
    ]),
  ]);

  const pick = (s) =>
    slotRows.find((r) => r._id === s) || { minutes: 0, count: 0 };
  const focusMinutes = focusRows[0]?.minutes || 0;

  return {
    doneMinutes: Math.max(pick("done").minutes, focusMinutes),
    estimate: task.estimatedMins ?? 60,
    plannedLeft: pick("planned").count,
  };
}

export async function completeTask(userId, task) {
  const updated = await Task.findOneAndUpdate(
    { _id: task._id, user: userId },
    { completed: true, completedAt: new Date(), autoCompleted: true },
    { new: true },
  ).lean();
  await StudySlot.deleteMany({
    user: userId,
    task: task._id,
    status: "planned",
  });
  return updated;
}

// After focus time is logged, drop the latest planned slots that are no longer needed.
export async function trimPlanned(userId, task, progress, today) {
  const needed = Math.max(progress.estimate - progress.doneMinutes, 0);
  const slots = await StudySlot.find({
    user: userId,
    task: task._id,
    status: "planned",
    date: { $gte: today },
  })
    .sort({ date: -1, start: -1 })
    .lean();

  let planned = slots.reduce((sum, s) => sum + s.minutes, 0);
  for (const slot of slots) {
    if (planned - slot.minutes < needed) continue;
    await StudySlot.deleteOne({ _id: slot._id });
    planned -= slot.minutes;
  }
}
