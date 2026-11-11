import http from "node:http";
import https from "node:https";

const BASE = process.env.API_URL || "http://localhost:5000/api";
const ALLOWED_ORIGIN =
  process.env.TEST_ALLOWED_ORIGIN || "http://localhost:5173";

function corsHeaderFor(origin) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE}/health`);
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      { method: "GET", headers: { Origin: origin } },
      (res) => {
        res.resume();
        resolve(res.headers["access-control-allow-origin"] || null);
      },
    );
    req.on("error", reject);
    req.end();
  });
}
let token = "";
let passed = 0;
let failed = 0;

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // some responses have no body
  }
  return { status: res.status, data };
}

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function run() {
  const email = `test${Date.now()}@example.com`;

  section("Health");
  let r = await call("GET", "/health");
  check("health check returns 200", r.status === 200);

  section("Security");
  const healthRes = await fetch(`${BASE}/health`);
  check(
    "security headers are present (helmet)",
    healthRes.headers.get("x-content-type-options") === "nosniff",
  );
  check(
    "server does not advertise Express",
    healthRes.headers.get("x-powered-by") === null,
  );
  check(
    "your own frontend origin is allowed by CORS",
    (await corsHeaderFor(ALLOWED_ORIGIN)) === ALLOWED_ORIGIN,
  );
  check(
    "an unknown website origin is not allowed by CORS",
    (await corsHeaderFor("https://evil.example.com")) === null,
  );

  section("Auth");
  r = await call("POST", "/auth/register", {
    name: "Test User",
    email,
    password: "secret123",
  });
  check(
    "register returns 201 with a token",
    r.status === 201 && Boolean(r.data?.token),
  );
  token = r.data?.token || "";

  r = await call("POST", "/auth/register", {
    name: "Test User",
    email,
    password: "secret123",
  });
  check("duplicate email returns 409", r.status === 409);

  r = await call("POST", "/auth/register", {
    name: "A",
    email: `x${Date.now()}@b.com`,
    password: "123",
  });
  check("short password returns 400", r.status === 400);

  r = await call("POST", "/auth/login", { email, password: "wrong-password" });
  check("wrong password returns 401", r.status === 401);

  r = await call("POST", "/auth/login", { email, password: "secret123" });
  check(
    "login returns 200 with a token",
    r.status === 200 && Boolean(r.data?.token),
  );
  token = r.data?.token || token;

  const saved = token;
  token = "";
  r = await call("GET", "/auth/me");
  check("/me without a token returns 401", r.status === 401);
  token = saved;

  r = await call("GET", "/auth/me");
  check(
    "/me with a token returns the user",
    r.status === 200 && r.data?.user?.email === email,
  );

  section("Subjects");
  r = await call("POST", "/subjects", {
    name: "Physics",
    type: "theory",
    color: "#4F46E5",
  });
  check("create subject returns 201", r.status === 201 && Boolean(r.data?._id));
  const subjectId = r.data?._id;

  r = await call("GET", "/subjects");
  check(
    "subject appears in the list",
    r.status === 200 && r.data.some((s) => s._id === subjectId),
  );

  section("Tasks");
  r = await call("POST", "/tasks", {
    title: "Lab report",
    subject: subjectId,
    category: "Assignment",
    dueDate: "2026-11-15",
    priority: "High",
    estimatedMins: 90,
  });
  check("create task returns 201", r.status === 201 && Boolean(r.data?._id));
  check("task estimate is saved", r.data?.estimatedMins === 90);
  const taskId = r.data?._id;

  r = await call("POST", "/tasks", { subject: subjectId });
  check("task without a title returns 400", r.status === 400);

  r = await call("POST", "/tasks", {
    title: "Too short",
    subject: subjectId,
    estimatedMins: 2,
  });
  check("estimate below 5 minutes returns 400", r.status === 400);

  r = await call("PUT", `/tasks/${taskId}`, { completed: true });
  check("mark task complete", r.status === 200 && r.data?.completed === true);

  r = await call("PUT", "/tasks/123", { completed: true });
  check("invalid task id returns 400", r.status === 400);

  r = await call("DELETE", `/tasks/${taskId}`);
  check("delete task returns 200", r.status === 200);

  r = await call("DELETE", `/tasks/${taskId}`);
  check("deleting it again returns 404", r.status === 404);

  section("Timetable");
  r = await call("POST", "/timetable", {
    subject: subjectId,
    days: [1, 3, 5],
    start: "09:00",
    end: "10:00",
    room: "B-204",
  });
  check(
    "add class on 3 days returns 201 with 3 entries",
    r.status === 201 && r.data?.length === 3,
    r.data?.message || "",
  );

  const classIds = r.data?.map((e) => e._id) || [];

  r = await call("POST", "/timetable", {
    subject: subjectId,
    days: [1],
    start: "09:30",
    end: "10:30",
  });
  check(
    "overlapping class returns 409",
    r.status === 409,
    r.data?.message || "",
  );

  r = await call("POST", "/timetable", {
    subject: subjectId,
    days: [1],
    start: "10:00",
    end: "11:00",
  });
  check("back-to-back class is allowed", r.status === 201);

  r = await call("POST", "/timetable", {
    subject: subjectId,
    days: [],
    start: "09:00",
    end: "10:00",
  });
  check("no days returns 400", r.status === 400);

  r = await call("POST", "/timetable", {
    subject: subjectId,
    days: [2],
    start: "11:00",
    end: "10:00",
  });
  check("end before start returns 400", r.status === 400);

  r = await call("PUT", `/timetable/${classIds[1]}`, {
    day: 3,
    start: "09:00",
    end: "10:30",
    room: "C-1",
  });
  check(
    "edit a class's time and room",
    r.status === 200 && r.data?.end === "10:30" && r.data?.room === "C-1",
    r.data?.message || "",
  );

  r = await call("PUT", `/timetable/${classIds[1]}`, {
    day: 3,
    start: "09:00",
    end: "10:30",
    room: "C-1",
  });
  check(
    "saving a class without changes does not clash with itself",
    r.status === 200,
  );

  r = await call("PUT", `/timetable/${classIds[1]}`, {
    day: 1,
    start: "09:30",
    end: "10:30",
  });
  check("moving a class onto another class returns 409", r.status === 409);

  r = await call("PUT", `/timetable/${classIds[1]}`, {
    day: 3,
    start: "11:00",
    end: "10:00",
  });
  check("edit with end before start returns 400", r.status === 400);

  r = await call("PUT", `/timetable/${classIds[1]}`, {
    day: 9,
    start: "09:00",
    end: "10:00",
  });
  check("edit with an invalid day returns 400", r.status === 400);

  r = await call("PUT", "/timetable/123", {
    day: 3,
    start: "09:00",
    end: "10:00",
  });
  check("edit with an invalid id returns 400", r.status === 400);

  section("Notes");
  r = await call("POST", "/notes", {
    title: "Optics",
    content: "Lenses...",
    subject: subjectId,
  });
  check("create note returns 201", r.status === 201 && Boolean(r.data?._id));
  const noteId = r.data?._id;

  r = await call("PUT", `/notes/${noteId}`, { pinned: true });
  check("pin note", r.status === 200 && r.data?.pinned === true);

  r = await call("GET", "/notes");
  check(
    "pinned note is listed first",
    r.status === 200 && r.data[0]?._id === noteId,
  );

  section("Pomodoro");
  r = await call("POST", "/tasks", { title: "Focus task", subject: subjectId });
  const focusTaskId = r.data?._id;

  r = await call("POST", "/pomodoro", { task: focusTaskId, minutes: 25 });
  check(
    "log a focus session returns 201",
    r.status === 201 && r.data?.minutes === 25,
  );

  r = await call("POST", "/pomodoro", { minutes: 0 });
  check("0 minutes returns 400", r.status === 400);

  r = await call("GET", "/pomodoro");
  check("session appears in the list", r.status === 200 && r.data.length === 1);

  section("Study slots");
  const PLAN_DATE = "2030-01-07"; // a Monday
  const minutesFor = (list, id) =>
    list.filter((s) => s.task === id).reduce((n, s) => n + s.minutes, 0);

  r = await call("POST", "/tasks", {
    title: "Plan A",
    subject: subjectId,
    priority: "High",
    dueDate: "2030-01-08",
    estimatedMins: 120,
  });
  const planA = r.data?._id;
  r = await call("POST", "/tasks", {
    title: "Plan B",
    subject: subjectId,
    priority: "Medium",
    dueDate: "2030-01-09",
    estimatedMins: 60,
  });
  const planB = r.data?._id;

  r = await call("POST", "/slots/generate", { date: PLAN_DATE });
  check(
    "generate returns 200 with slots",
    r.status === 200 && r.data?.slots?.length > 0,
    r.data?.message || "",
  );
  const first = r.data?.slots || [];
  check("task A gets its full 120 minutes", minutesFor(first, planA) === 120);
  check("task B gets its full 60 minutes", minutesFor(first, planB) === 60);
  check("nothing is left unscheduled", r.data?.unscheduled?.length === 0);
  check(
    "slots stay inside 08:00-22:00",
    first.every((s) => s.start >= "08:00" && s.end <= "22:00"),
  );
  check(
    "slots do not overlap Monday classes (09:00-11:00)",
    first.every((s) => s.end <= "09:00" || s.start >= "11:00"),
  );
  const sorted = [...first].sort((a, b) => a.start.localeCompare(b.start));
  check(
    "slots do not overlap each other",
    sorted.every((s, i) => i === 0 || s.start >= sorted[i - 1].end),
  );
  check("higher priority task comes first", first[0]?.task === planA);

  r = await call("GET", `/slots?date=${PLAN_DATE}`);
  check(
    "GET returns the same slots",
    r.status === 200 && r.data.length === first.length,
  );

  r = await call("POST", "/slots/generate", { date: PLAN_DATE });
  check(
    "generating again does not duplicate slots",
    r.status === 200 && r.data.slots.length === first.length,
  );
  const firstSlotId = r.data.slots[0]._id;

  r = await call("PATCH", `/slots/${firstSlotId}`, { status: "done" });
  check("mark a slot done", r.status === 200 && r.data?.status === "done");
  const doneSlot = r.data;

  r = await call("PATCH", `/slots/${firstSlotId}`, { status: "finished" });
  check("invalid status returns 400", r.status === 400);

  r = await call("POST", "/slots/generate", { date: PLAN_DATE });
  const afterDone = r.data?.slots || [];
  check(
    "done slot is kept in place",
    afterDone.some(
      (s) =>
        s._id === firstSlotId &&
        s.status === "done" &&
        s.start === doneSlot.start,
    ),
  );
  check(
    "task A still totals 120 minutes after regenerating",
    minutesFor(afterDone, planA) === 120,
  );
  check(
    "no planned slot overlaps the done slot",
    afterDone
      .filter((s) => s._id !== firstSlotId)
      .every((s) => s.end <= doneSlot.start || s.start >= doneSlot.end),
  );

  const nextSlot = afterDone.find((s) => s.status === "planned");
  r = await call("PATCH", `/slots/${nextSlot._id}`, { status: "skipped" });
  check(
    "mark a slot skipped",
    r.status === 200 && r.data?.status === "skipped",
  );

  r = await call("POST", "/slots/generate", { date: PLAN_DATE });
  const afterSkip = r.data?.slots || [];
  check(
    "skipped slot stays and blocks its time",
    afterSkip.some((s) => s._id === nextSlot._id && s.status === "skipped") &&
      afterSkip
        .filter((s) => s._id !== nextSlot._id)
        .every((s) => s.end <= nextSlot.start || s.start >= nextSlot.end),
  );

  r = await call("PUT", `/tasks/${planB}`, { completed: true });
  r = await call("GET", `/slots?date=${PLAN_DATE}`);
  check(
    "completing a task removes its planned slots",
    r.data.every((s) => !(s.task === planB && s.status === "planned")),
  );

  r = await call("POST", "/slots/generate", { date: "2000-01-03" });
  check("planning a past date returns 400", r.status === 400);
  r = await call("POST", "/slots/generate", { date: "11/09/2026" });
  check("bad date format returns 400", r.status === 400);
  r = await call("GET", "/slots");
  check("GET without a date returns 400", r.status === 400);

  section("Settings");
  r = await call("GET", "/settings");
  check(
    "defaults are returned when nothing is saved",
    r.status === 200 &&
      r.data?.dayStart === "08:00" &&
      r.data?.dayEnd === "22:00" &&
      r.data?.blockedTimes?.length === 0,
  );

  check(
    "reminder defaults: briefing on at 07:00, slot reminders off",
    r.data?.briefingEnabled === true &&
      r.data?.briefingTime === "07:00" &&
      r.data?.slotRemindersEnabled === false &&
      r.data?.slotReminderLeadMins === 10,
  );

  const goodSettings = {
    dayStart: "09:00",
    dayEnd: "20:00",
    minSlotMins: 30,
    maxSlotMins: 60,
    breakMins: 5,
    blockedTimes: [{ label: "Lunch", start: "12:00", end: "13:00" }],
  };

  r = await call("PUT", "/settings", {
    ...goodSettings,
    dayStart: "22:00",
    dayEnd: "08:00",
  });
  check("study day ending before it starts returns 400", r.status === 400);

  r = await call("PUT", "/settings", {
    ...goodSettings,
    minSlotMins: 60,
    maxSlotMins: 45,
  });
  check("maximum slot below minimum returns 400", r.status === 400);

  r = await call("PUT", "/settings", {
    ...goodSettings,
    blockedTimes: [{ label: "Lunch", start: "13:00", end: "12:00" }],
  });
  check("blocked time ending before it starts returns 400", r.status === 400);

  r = await call("PUT", "/settings", {
    ...goodSettings,
    blockedTimes: [{ label: "", start: "12:00", end: "13:00" }],
  });
  check("blocked time without a name returns 400", r.status === 400);

  r = await call("PUT", "/settings", goodSettings);
  check(
    "valid settings are saved",
    r.status === 200 &&
      r.data?.dayStart === "09:00" &&
      r.data?.blockedTimes?.length === 1,
    r.data?.message || "",
  );

  r = await call("GET", "/settings");
  check(
    "saved settings persist",
    r.status === 200 && r.data?.maxSlotMins === 60,
  );

  check(
    "saving without reminder fields keeps the reminder defaults",
    r.data?.briefingEnabled === true && r.data?.slotRemindersEnabled === false,
  );

  r = await call("PUT", "/settings", {
    ...goodSettings,
    briefingTime: "25:00",
  });
  check("invalid briefing time returns 400", r.status === 400);

  r = await call("PUT", "/settings", {
    ...goodSettings,
    briefingEnabled: "yes",
  });
  check("non-boolean briefing flag returns 400", r.status === 400);

  r = await call("PUT", "/settings", {
    ...goodSettings,
    slotReminderLeadMins: 0,
  });
  check("reminder lead time of 0 returns 400", r.status === 400);

  r = await call("PUT", "/settings", {
    ...goodSettings,
    briefingEnabled: false,
    briefingTime: "06:30",
    slotRemindersEnabled: true,
    slotReminderLeadMins: 15,
  });
  check(
    "reminder settings are saved",
    r.status === 200 &&
      r.data?.briefingEnabled === false &&
      r.data?.briefingTime === "06:30" &&
      r.data?.slotRemindersEnabled === true &&
      r.data?.slotReminderLeadMins === 15,
    r.data?.message || "",
  );
  r = await call("GET", "/settings");
  check(
    "reminder settings persist",
    r.status === 200 &&
      r.data?.briefingTime === "06:30" &&
      r.data?.slotReminderLeadMins === 15,
  );

  const SETTINGS_DATE = "2030-01-08"; // a Tuesday, so no classes
  r = await call("POST", "/tasks", {
    title: "Settings task",
    subject: subjectId,
    priority: "High",
    estimatedMins: 240,
  });
  r = await call("POST", "/slots/generate", { date: SETTINGS_DATE });
  const custom = r.data?.slots || [];
  check(
    "plan is generated with the saved settings",
    r.status === 200 && custom.length > 0,
    r.data?.message || "",
  );
  check(
    "slots stay inside the saved study hours (09:00-20:00)",
    custom.every((s) => s.start >= "09:00" && s.end <= "20:00"),
  );
  check(
    "no slot overlaps the blocked lunch (12:00-13:00)",
    custom.every((s) => s.end <= "12:00" || s.start >= "13:00"),
  );
  check(
    "no slot is longer than the saved maximum",
    custom.every((s) => s.minutes <= 60),
  );

  section("Daily report");
  const pad = (n) => String(n).padStart(2, "0");
  const dayWindow = (y, m, d) => {
    const start = new Date(y, m, d);
    const end = new Date(y, m, d + 1);
    return {
      date: `${y}-${pad(m + 1)}-${pad(d)}`,
      query: `from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`,
    };
  };
  const nowLocal = new Date();
  const todayWin = dayWindow(
    nowLocal.getFullYear(),
    nowLocal.getMonth(),
    nowLocal.getDate(),
  );
  const reportUrl = `/report?date=${todayWin.date}&${todayWin.query}`;

  r = await call("POST", "/tasks", {
    title: "Due today",
    subject: subjectId,
    dueDate: todayWin.date,
    priority: "High",
    estimatedMins: 60,
  });
  const dueTodayId = r.data?._id;
  r = await call("POST", "/tasks", {
    title: "Very late",
    subject: subjectId,
    dueDate: "2000-01-01",
    priority: "Low",
  });
  const lateId = r.data?._id;
  r = await call("POST", "/tasks", {
    title: "Finish me",
    subject: subjectId,
    priority: "Medium",
  });
  const finishId = r.data?._id;

  r = await call("GET", reportUrl);
  check(
    "report returns 200 for today",
    r.status === 200 && r.data?.date === todayWin.date,
    r.data?.message || "",
  );
  check(
    "task due today is listed as due",
    Boolean(r.data?.dueTasks?.some((t) => t._id === dueTodayId)),
  );
  check(
    "old unfinished task is listed as overdue",
    Boolean(r.data?.overdueTasks?.some((t) => t._id === lateId)),
  );
  check(
    "unfinished task is not listed as completed",
    !r.data?.completedTasks?.some((t) => t._id === finishId),
  );
  check(
    "focus time matches the logged Pomodoro session",
    r.data?.focus?.sessions === 1 && r.data?.focus?.minutes === 25,
  );
  check("next day info is included", r.data?.next?.topTasks?.length > 0);

  r = await call("PUT", `/tasks/${finishId}`, { completed: true });
  check(
    "completing a task records completedAt",
    r.status === 200 && Boolean(r.data?.completedAt),
  );
  r = await call("GET", reportUrl);
  check(
    "completed task appears in today's report",
    Boolean(r.data?.completedTasks?.some((t) => t._id === finishId)),
  );

  r = await call("PUT", `/tasks/${finishId}`, { completed: false });
  check(
    "unticking a task clears completedAt",
    r.status === 200 && r.data?.completedAt === null,
  );
  r = await call("GET", reportUrl);
  check(
    "unticked task leaves the completed list",
    !r.data?.completedTasks?.some((t) => t._id === finishId),
  );
  r = await call("PUT", `/tasks/${finishId}`, { completed: true });

  r = await call("PUT", `/tasks/${finishId}`, { completed: "yes" });
  check("non-boolean completed value returns 400", r.status === 400);

  const planWin = dayWindow(2030, 0, 7);
  r = await call("GET", `/report?date=${planWin.date}&${planWin.query}`);
  check(
    "slot totals match the plan day",
    r.status === 200 &&
      r.data?.totals?.done?.count === 1 &&
      r.data?.totals?.skipped?.count === 1,
    r.data?.message || "",
  );
  check(
    "done minutes match the slot marked done",
    r.data?.totals?.done?.minutes === doneSlot.minutes,
  );
  check(
    "slot list matches the totals",
    r.data?.slots?.length ===
      r.data.totals.done.count +
        r.data.totals.skipped.count +
        r.data.totals.planned.count,
  );
  check(
    "a future day has no completed tasks or focus time",
    r.data?.completedTasks?.length === 0 && r.data?.focus?.sessions === 0,
  );
  check(
    "next day shows the planned minutes",
    r.data?.next?.date === "2030-01-08" && r.data?.next?.plannedMinutes > 0,
  );

  r = await call("GET", `/report?date=${todayWin.date}`);
  check("report without from and to returns 400", r.status === 400);

  const wide = `from=${encodeURIComponent(new Date(2030, 0, 7).toISOString())}&to=${encodeURIComponent(new Date(2030, 0, 10).toISOString())}`;
  r = await call("GET", `/report?date=2030-01-07&${wide}`);
  check("a range longer than one day returns 400", r.status === 400);

  r = await call("GET", `/report?date=bad&${todayWin.query}`);
  check("bad date returns 400", r.status === 400);

  section("Choosing tasks for a plan");
  const PICK_DATE = "2030-01-10"; // a Thursday, so no classes
  r = await call("POST", "/tasks", {
    title: "Pick one",
    subject: subjectId,
    priority: "High",
    estimatedMins: 60,
  });
  const pickOne = r.data?._id;
  r = await call("POST", "/tasks", {
    title: "Pick two",
    subject: subjectId,
    priority: "Low",
    estimatedMins: 45,
  });
  const pickTwo = r.data?._id;

  r = await call("POST", "/slots/generate", {
    date: PICK_DATE,
    taskIds: [pickOne],
  });
  check(
    "plan with one selected task returns 200",
    r.status === 200 && r.data?.slots?.length > 0,
    r.data?.message || "",
  );
  check(
    "only the selected task is planned",
    (r.data?.slots || []).every((s) => s.task === pickOne),
  );
  check(
    "the selected task gets its full time",
    minutesFor(r.data?.slots || [], pickOne) === 60,
  );

  r = await call("POST", "/slots/generate", {
    date: PICK_DATE,
    taskIds: [pickOne, pickTwo],
  });
  check(
    "ticking a second task plans it too",
    minutesFor(r.data?.slots || [], pickOne) === 60 &&
      minutesFor(r.data?.slots || [], pickTwo) === 45,
  );

  r = await call("POST", "/slots/generate", {
    date: PICK_DATE,
    taskIds: [pickTwo],
  });
  check(
    "unticking a task removes its planned slots",
    (r.data?.slots || []).length > 0 &&
      (r.data?.slots || []).every((s) => s.task === pickTwo),
  );

  r = await call("POST", "/slots/generate", { date: PICK_DATE, taskIds: [] });
  check("an empty selection returns 400", r.status === 400);

  r = await call("POST", "/slots/generate", {
    date: PICK_DATE,
    taskIds: ["not-an-id"],
  });
  check("an invalid task id returns 400", r.status === 400);

  r = await call("POST", "/slots/generate", {
    date: PICK_DATE,
    taskIds: "abc",
  });
  check("taskIds that is not a list returns 400", r.status === 400);

  section("Data isolation (second user)");

  const firstToken = token;

  token = "";
  r = await call("GET", "/subjects");
  check("subjects without a token returns 401", r.status === 401);

  r = await call("POST", "/auth/register", {
    name: "Other User",
    email: `other${Date.now()}@example.com`,
    password: "secret123",
  });
  token = r.data?.token || "";

  r = await call("GET", "/subjects");
  check(
    "second user sees no subjects",
    r.status === 200 && r.data.length === 0,
  );

  r = await call("GET", "/timetable");
  check(
    "second user sees no timetable",
    r.status === 200 && r.data.length === 0,
  );

  r = await call("GET", "/notes");
  check("second user sees no notes", r.status === 200 && r.data.length === 0);

  r = await call("DELETE", `/subjects/${subjectId}`);
  check("second user cannot delete first user's subject", r.status === 404);

  r = await call("PUT", `/notes/${noteId}`, { title: "Hacked" });
  check("second user cannot edit first user's note", r.status === 404);

  r = await call("POST", "/timetable", {
    subject: subjectId,
    days: [1],
    start: "08:00",
    end: "09:00",
  });
  check("second user cannot use first user's subject", r.status === 404);

  r = await call("POST", "/tasks", {
    title: "Sneaky task",
    subject: subjectId,
  });
  check(
    "second user cannot create a task under first user's subject",
    r.status === 404,
  );

  r = await call("POST", "/pomodoro", { task: focusTaskId, minutes: 25 });
  check(
    "second user cannot log a session on first user's task",
    r.status === 404,
  );

  r = await call("GET", `/slots?date=${PLAN_DATE}`);
  check("second user sees no slots", r.status === 200 && r.data.length === 0);

  r = await call("PATCH", `/slots/${firstSlotId}`, { status: "skipped" });
  check("second user cannot change first user's slot", r.status === 404);

  r = await call("GET", "/settings");
  check(
    "second user gets default settings, not the first user's",
    r.status === 200 &&
      r.data?.dayStart === "08:00" &&
      r.data?.blockedTimes?.length === 0,
  );

  r = await call("GET", reportUrl);
  check(
    "second user's report is empty",
    r.status === 200 &&
      r.data?.completedTasks?.length === 0 &&
      r.data?.focus?.sessions === 0 &&
      r.data?.dueTasks?.length === 0 &&
      r.data?.overdueTasks?.length === 0,
  );

  r = await call("POST", "/slots/generate", {
    date: PICK_DATE,
    taskIds: [pickOne],
  });
  check(
    "second user cannot plan first user's task",
    r.status === 200 && r.data?.slots?.length === 0,
  );

  token = firstToken;

  r = await call("GET", "/notes");
  check(
    "first user's note is unchanged",
    r.status === 200 &&
      r.data.some((n) => n._id === noteId && n.title === "Optics"),
  );

  section("Cleanup and cascade");
  r = await call("DELETE", `/subjects/${subjectId}`);
  check("delete subject returns 200", r.status === 200);

  r = await call("GET", "/timetable");
  check(
    "its classes were removed",
    r.status === 200 && !r.data.some((e) => e.subject === subjectId),
  );

  r = await call("GET", `/slots?date=${PLAN_DATE}`);
  check(
    "its study slots were removed",
    r.status === 200 && r.data.length === 0,
  );

  r = await call("DELETE", `/notes/${noteId}`);
  check("delete note returns 200", r.status === 200);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error("\nCould not run the tests. Is the server running?");
  console.error(err.message);
  process.exit(1);
});
