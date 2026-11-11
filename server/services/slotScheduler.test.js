import test from "node:test";
import assert from "node:assert/strict";
import {
  generateSlots,
  findFreeGaps,
  toMinutes,
  toTime,
  weekdayOf,
  taskScore,
} from "./slotScheduler.js";

const MONDAY = "2026-11-09";

test("time helpers convert both ways", () => {
  assert.equal(toMinutes("09:30"), 570);
  assert.equal(toTime(570), "09:30");
  assert.equal(toTime(toMinutes("00:05")), "00:05");
});

test("weekdayOf uses 0 = Sunday", () => {
  assert.equal(weekdayOf(MONDAY), 1);
  assert.equal(weekdayOf("2026-11-08"), 0);
});

test("findFreeGaps subtracts busy time", () => {
  const busy = [
    { start: 540, end: 600 },
    { start: 660, end: 720 },
  ];
  assert.deepEqual(findFreeGaps(480, 1320, busy, 30), [
    { start: 480, end: 540 },
    { start: 600, end: 660 },
    { start: 720, end: 1320 },
  ]);
});

test("findFreeGaps drops gaps shorter than the minimum", () => {
  assert.deepEqual(findFreeGaps(480, 1320, [{ start: 500, end: 600 }], 30), [
    { start: 600, end: 1320 },
  ]);
});

test("findFreeGaps merges overlapping busy intervals", () => {
  const busy = [
    { start: 540, end: 660 },
    { start: 600, end: 720 },
  ];
  assert.deepEqual(findFreeGaps(480, 840, busy, 30), [
    { start: 480, end: 540 },
    { start: 720, end: 840 },
  ]);
});

test("taskScore ranks overdue and urgent work higher", () => {
  assert.equal(
    taskScore({ priority: "High", dueDate: "2026-11-01" }, MONDAY),
    55,
  );
  assert.equal(taskScore({ priority: "Medium", dueDate: MONDAY }, MONDAY), 40);
  assert.equal(taskScore({ priority: "Low", dueDate: "" }, MONDAY), 10);
});

test("no tasks means no slots", () => {
  const r = generateSlots({ date: MONDAY });
  assert.equal(r.slots.length, 0);
  assert.equal(r.unscheduled.length, 0);
});

test("slots never overlap a class and stay inside the study window", () => {
  const classes = [
    { day: 1, start: "09:00", end: "10:00" },
    { day: 1, start: "11:00", end: "12:30" },
    { day: 1, start: "14:00", end: "15:00" },
  ];
  const tasks = [
    { id: "a", priority: "High", dueDate: "2026-11-10", estimatedMins: 300 },
    { id: "b", priority: "Medium", dueDate: "2026-11-12", estimatedMins: 200 },
    { id: "c", priority: "Low", dueDate: "", estimatedMins: 120 },
  ];
  const { slots } = generateSlots({ date: MONDAY, classes, tasks });
  assert.ok(slots.length > 0);
  for (const s of slots) {
    assert.ok(
      s.start >= "08:00" && s.end <= "22:00",
      `${s.start}-${s.end} outside window`,
    );
    for (const c of classes) {
      assert.ok(
        s.start >= c.end || s.end <= c.start,
        `slot ${s.start}-${s.end} overlaps class ${c.start}-${c.end}`,
      );
    }
  }
});

test("classes on other weekdays are ignored", () => {
  const classes = [{ day: 2, start: "08:00", end: "12:00" }];
  const tasks = [{ id: "a", priority: "High", dueDate: "", estimatedMins: 60 }];
  const { slots } = generateSlots({ date: MONDAY, classes, tasks });
  assert.equal(slots[0].start, "08:00");
});

test("the higher priority task is placed first", () => {
  const tasks = [
    { id: "low", priority: "Low", dueDate: "2026-12-30", estimatedMins: 60 },
    { id: "high", priority: "High", dueDate: "2026-11-10", estimatedMins: 60 },
  ];
  const { slots } = generateSlots({
    date: MONDAY,
    tasks,
    prefs: { dayStart: "09:00", dayEnd: "12:00" },
  });
  assert.equal(slots[0].task, "high");
});

test("a break separates slots inside one gap", () => {
  const tasks = [
    { id: "a", priority: "High", dueDate: "", estimatedMins: 200 },
  ];
  const { slots } = generateSlots({
    date: MONDAY,
    tasks,
    prefs: { dayStart: "14:00", dayEnd: "22:00" },
  });
  assert.equal(slots.length, 3);
  assert.equal(slots[0].start, "14:00");
  assert.equal(slots[0].end, "15:30");
  assert.equal(slots[1].start, "15:40");
  assert.equal(slots[2].minutes, 20);
});

test("a long task is split across gaps", () => {
  const classes = [{ day: 1, start: "10:00", end: "11:00" }];
  const tasks = [
    { id: "a", priority: "High", dueDate: "", estimatedMins: 120 },
  ];
  const r = generateSlots({
    date: MONDAY,
    classes,
    tasks,
    prefs: { dayStart: "09:00", dayEnd: "13:00" },
  });
  assert.equal(r.slots.length, 2);
  assert.equal(r.plannedMinutes, 120);
  assert.equal(r.unscheduled.length, 0);
});

test("minutes already committed reduce what is left to plan", () => {
  const tasks = [{ id: "a", priority: "High", dueDate: "", estimatedMins: 60 }];
  const { slots } = generateSlots({
    date: MONDAY,
    tasks,
    committed: { a: 45 },
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].minutes, 15);
});

test("completed tasks are ignored", () => {
  const tasks = [
    {
      id: "a",
      priority: "High",
      dueDate: "",
      estimatedMins: 60,
      completed: true,
    },
  ];
  assert.equal(generateSlots({ date: MONDAY, tasks }).slots.length, 0);
});

test("when planning today, slots start after the current time", () => {
  const tasks = [{ id: "a", priority: "High", dueDate: "", estimatedMins: 60 }];
  const { slots } = generateSlots({ date: MONDAY, tasks, from: "14:37" });
  assert.equal(slots[0].start, "14:40");
});

test("work that does not fit is reported as unscheduled", () => {
  const tasks = [
    { id: "a", priority: "High", dueDate: "", estimatedMins: 600 },
  ];
  const r = generateSlots({
    date: MONDAY,
    tasks,
    prefs: { dayStart: "09:00", dayEnd: "11:00" },
  });
  assert.equal(r.plannedMinutes, 90);
  assert.deepEqual(r.unscheduled, [{ task: "a", minutes: 510 }]);
});

test("kept slots count as busy time", () => {
  const tasks = [{ id: "a", priority: "High", dueDate: "", estimatedMins: 60 }];
  const { slots } = generateSlots({
    date: MONDAY,
    tasks,
    keptSlots: [{ start: "09:00", end: "10:00" }],
    prefs: { dayStart: "09:00", dayEnd: "11:00" },
  });
  assert.equal(slots[0].start, "10:00");
});

test("blocked times are never used for study", () => {
  const tasks = [
    { id: "a", priority: "High", dueDate: "", estimatedMins: 240 },
  ];
  const blocked = [{ start: "13:00", end: "14:00" }];
  const { slots } = generateSlots({
    date: MONDAY,
    tasks,
    blocked,
    prefs: { dayStart: "11:00", dayEnd: "16:00" },
  });
  assert.ok(slots.length > 0);
  for (const s of slots) {
    assert.ok(
      s.end <= "13:00" || s.start >= "14:00",
      `${s.start}-${s.end} hits the block`,
    );
  }
});

test("custom slot and break lengths are respected", () => {
  const tasks = [
    { id: "a", priority: "High", dueDate: "", estimatedMins: 120 },
  ];
  const { slots } = generateSlots({
    date: MONDAY,
    tasks,
    prefs: {
      dayStart: "09:00",
      dayEnd: "12:00",
      maxSlotMins: 45,
      breakMins: 5,
    },
  });
  assert.equal(slots.length, 3);
  assert.equal(slots[0].end, "09:45");
  assert.equal(slots[1].start, "09:50");
  assert.equal(
    slots.reduce((n, s) => n + s.minutes, 0),
    120,
  );
});

test("a split never strands a tiny leftover", () => {
  const classes = [{ day: 1, start: "12:00", end: "13:00" }];
  const tasks = [{ id: "a", priority: "High", dueDate: "", estimatedMins: 60 }];
  const r = generateSlots({
    date: MONDAY,
    classes,
    tasks,
    prefs: { dayStart: "11:10", dayEnd: "16:00" },
  });
  assert.equal(r.slots[0].minutes, 45);
  assert.equal(r.plannedMinutes, 60);
  assert.equal(r.unscheduled.length, 0);
});

test("a very short task is still scheduled", () => {
  const tasks = [{ id: "a", priority: "High", dueDate: "", estimatedMins: 10 }];
  const { slots } = generateSlots({ date: MONDAY, tasks });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].minutes, 10);
});
