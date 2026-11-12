const BASE = process.env.API_URL || "http://localhost:5000/api";
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

const long = (n) => "x".repeat(n);
const minutesFor = (list, id) =>
  list.filter((s) => s.task === id).reduce((n, s) => n + s.minutes, 0);

async function run() {
  section("Input limits and validation");

  let r = await call("POST", "/auth/register", {
    name: long(61),
    email: `n${Date.now()}@example.com`,
    password: "secret123",
  });
  check(
    "a name longer than 60 characters returns 400",
    r.status === 400,
    r.data?.message || "",
  );

  r = await call("POST", "/auth/register", {
    name: "Robust User",
    email: `p${Date.now()}@example.com`,
    password: long(73),
  });
  check("a password longer than 72 characters returns 400", r.status === 400);

  r = await call("POST", "/auth/register", {
    name: 12345,
    email: `q${Date.now()}@example.com`,
    password: "secret123",
  });
  check("a name that is not text returns 400, not a crash", r.status === 400);

  const bad = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  check("malformed JSON returns 400", bad.status === 400);

  r = await call("POST", "/auth/register", {
    name: "Robust User",
    email: `robust${Date.now()}@example.com`,
    password: "secret123",
  });
  check("registration works", r.status === 201 && Boolean(r.data?.token));
  token = r.data?.token || "";
  const limitsToken = token;

  r = await call("POST", "/subjects", { name: long(41), type: "theory" });
  check("subject name over 40 characters returns 400", r.status === 400);

  r = await call("POST", "/subjects", { name: "Bad colour", color: "red" });
  check("a color that is not hex returns 400", r.status === 400);

  r = await call("POST", "/subjects", {
    name: "Limits",
    type: "theory",
    color: "#4F46E5",
  });
  const subjectId = r.data?._id;
  check(
    "subject with a normal name returns 201",
    r.status === 201 && Boolean(subjectId),
  );

  r = await call("POST", "/tasks", { title: long(121), subject: subjectId });
  check("task title over 120 characters returns 400", r.status === 400);

  r = await call("POST", "/tasks", { title: long(120), subject: subjectId });
  check("task title of exactly 120 characters is accepted", r.status === 201);
  const taskId = r.data?._id;

  r = await call("PUT", `/tasks/${taskId}`, { title: long(121) });
  check(
    "editing a task title beyond 120 characters returns 400",
    r.status === 400,
  );

  r = await call("POST", "/tasks", {
    title: "Bad date",
    subject: subjectId,
    dueDate: "2026-13-45",
  });
  check("an impossible due date returns 400", r.status === 400);

  r = await call("POST", "/tasks", {
    title: "Bad date 2",
    subject: subjectId,
    dueDate: "tomorrow",
  });
  check("a due date that is not YYYY-MM-DD returns 400", r.status === 400);

  r = await call("POST", "/tasks", {
    title: "Ok date",
    subject: subjectId,
    dueDate: "2030-02-28",
  });
  check("a valid due date is accepted", r.status === 201);

  r = await call("POST", "/tasks", {
    title: "Half minutes",
    subject: subjectId,
    estimatedMins: 60.5,
  });
  check("a fractional estimate returns 400", r.status === 400);

  r = await call("POST", "/notes", { title: long(121), content: "" });
  check("note title over 120 characters returns 400", r.status === 400);

  r = await call("POST", "/notes", { title: "Big", content: long(30001) });
  check("note content over 30000 characters returns 400", r.status === 400);

  r = await call("POST", "/notes", { title: "Fine", content: long(30000) });
  check(
    "note content of exactly 30000 characters is accepted",
    r.status === 201,
  );

  r = await call("POST", "/notes", { title: "Edit me" });
  const noteId = r.data?._id;
  r = await call("PUT", `/notes/${noteId}`, { title: long(121) });
  check(
    "editing a note title beyond 120 characters returns 400",
    r.status === 400,
  );

  r = await call("POST", "/timetable", {
    subject: subjectId,
    days: [2],
    start: "09:00",
    end: "10:00",
    room: long(31),
  });
  check("room over 30 characters returns 400", r.status === 400);

  section("Missed slots");

  r = await call("POST", "/auth/register", {
    name: "Missed User",
    email: `missed${Date.now()}@example.com`,
    password: "secret123",
  });
  token = r.data?.token || "";

  r = await call("POST", "/subjects", { name: "Missed", type: "theory" });
  const mSubject = r.data?._id;
  r = await call("POST", "/tasks", {
    title: "First task",
    subject: mSubject,
    priority: "High",
    estimatedMins: 60,
  });
  const t1 = r.data?._id;
  r = await call("POST", "/tasks", {
    title: "Second task",
    subject: mSubject,
    priority: "Low",
    estimatedMins: 45,
  });
  const t2 = r.data?._id;

  // A day that has "passed" is simulated by sending a later value for "today".
  const DAY_ONE = "2030-01-22";
  const DAY_TWO = "2030-01-23";
  const DAY_THREE = "2030-01-24";

  r = await call("GET", `/slots/missed?today=${DAY_ONE}`);
  check(
    "nothing is missed at the start",
    r.status === 200 && r.data?.count === 0 && r.data?.minutes === 0,
  );

  r = await call("POST", "/slots/generate", { date: DAY_ONE, today: DAY_ONE });
  check(
    "a plan is generated for the first day",
    r.status === 200 && r.data?.slots?.length === 2,
    r.data?.message || "",
  );

  r = await call("GET", `/slots/missed?today=${DAY_ONE}`);
  check(
    "slots on the same day are not missed yet",
    r.status === 200 && r.data?.count === 0,
  );

  r = await call("GET", `/slots/missed?today=${DAY_TWO}`);
  check(
    "planned slots from the day before count as missed",
    r.status === 200 &&
      r.data?.count === 2 &&
      r.data?.minutes === 105 &&
      r.data?.earliest === DAY_ONE,
    JSON.stringify(r.data),
  );

  r = await call("GET", "/slots/missed");
  check("missed without a date returns 400", r.status === 400);

  r = await call("GET", "/slots/missed?today=bad");
  check("missed with a bad date returns 400", r.status === 400);

  r = await call("GET", "/slots/missed?today=2030-03-30");
  check(
    "slots older than 14 days are not reported",
    r.status === 200 && r.data?.count === 0,
  );

  r = await call("POST", "/slots/generate", {
    date: DAY_TWO,
    today: DAY_TWO,
    taskIds: [t1],
  });
  check(
    "the next day is planned with only one task",
    r.status === 200 && r.data?.slots?.length === 1,
  );

  r = await call("GET", `/slots/missed?today=${DAY_TWO}`);
  check(
    "a task left out of the plan stays flagged as missed",
    r.status === 200 && r.data?.count === 1 && r.data?.minutes === 45,
    JSON.stringify(r.data),
  );

  r = await call("POST", "/slots/generate", { date: DAY_TWO, today: DAY_TWO });
  const dayTwoSlots = r.data?.slots || [];
  check(
    "planning everything includes the missed task",
    r.status === 200 &&
      minutesFor(dayTwoSlots, t1) === 60 &&
      minutesFor(dayTwoSlots, t2) === 45,
  );

  r = await call("GET", `/slots/missed?today=${DAY_TWO}`);
  check(
    "nothing is missed after planning everything",
    r.status === 200 && r.data?.count === 0,
  );

  r = await call("PATCH", `/slots/${dayTwoSlots[0]._id}`, { status: "done" });
  check(
    "a slot can be marked done",
    r.status === 200 && r.data?.status === "done",
  );

  r = await call("GET", `/slots/missed?today=${DAY_THREE}`);
  check(
    "a done slot is not counted as missed, an unfinished one is",
    r.status === 200 && r.data?.count === 1,
    JSON.stringify(r.data),
  );

  token = limitsToken;
  r = await call("GET", `/slots/missed?today=${DAY_TWO}`);
  check(
    "another user's missed slots are not visible",
    r.status === 200 && r.data?.count === 0,
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error("\nCould not run the tests. Is the server running?");
  console.error(err.message);
  process.exit(1);
});
