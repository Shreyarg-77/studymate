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
    body: body === undefined ? undefined : JSON.stringify(body),
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

const section = (title) => console.log(`\n${title}`);
const minutes = (list, id) =>
  list.filter((s) => s.task === id).reduce((n, s) => n + s.minutes, 0);
const ids = (list) =>
  list
    .map((s) => s._id)
    .sort()
    .join();

async function run() {
  let r = await call("POST", "/auth/register", {
    name: "Plan User",
    email: `test${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`,
    password: "secret123",
  });
  check("register works", r.status === 201 && Boolean(r.data?.token));
  token = r.data?.token || "";

  r = await call("POST", "/subjects", { name: "Plan once", type: "theory" });
  const subjectId = r.data?._id;
  const mk = async (title, estimatedMins, priority = "High") =>
    (
      await call("POST", "/tasks", {
        title,
        subject: subjectId,
        priority,
        estimatedMins,
      })
    ).data?._id;

  section("Fill keeps what exists");
  const A = await mk("A", 60);
  const B = await mk("B", 60, "Medium");
  const D1 = "2030-05-06";
  r = await call("POST", "/slots/generate", { date: D1, mode: "fill" });
  const first = r.data?.slots || [];
  check(
    "first fill plans both tasks",
    minutes(first, A) === 60 && minutes(first, B) === 60,
  );
  r = await call("POST", "/slots/generate", { date: D1, mode: "fill" });
  check(
    "filling again changes nothing",
    ids(r.data?.slots || []) === ids(first),
  );

  const C = await mk("C", 45, "Low");
  r = await call("POST", "/slots/generate", { date: D1, mode: "fill" });
  const afterC = r.data?.slots || [];
  check("a new task is added to the plan", minutes(afterC, C) === 45);
  check(
    "existing slots keep their ids and times",
    first.every((s) =>
      afterC.some((x) => x._id === s._id && x.start === s.start),
    ),
  );
  const sorted = [...afterC].sort((a, b) => a.start.localeCompare(b.start));
  check(
    "no slots overlap",
    sorted.every((s, i) => i === 0 || s.start >= sorted[i - 1].end),
  );
  r = await call("POST", "/slots/generate", { date: D1 });
  check(
    "the default mode still rebuilds the day",
    r.status === 200 && minutes(r.data?.slots || [], A) === 60,
  );

  section("Focus time counts toward the task");
  const D2 = "2030-05-07";
  const E = await mk("E", 60);
  r = await call("POST", "/slots/generate", {
    date: D2,
    taskIds: [E],
    mode: "fill",
  });
  check("E is planned", (r.data?.slots || []).length > 0);
  r = await call("POST", "/pomodoro", {
    task: E,
    minutes: 60,
    today: "2030-05-01",
  });
  check(
    "a full-length session completes the task",
    r.status === 201 && r.data?.updatedTask?.completed === true,
  );
  r = await call("GET", `/slots?date=${D2}`);
  check(
    "its planned slots are removed",
    r.data.every((s) => s.task !== E),
  );

  const F = await mk("F", 120);
  r = await call("POST", "/slots/generate", {
    date: D2,
    taskIds: [F],
    mode: "fill",
  });
  check(
    "F is planned for 120 minutes",
    minutes(r.data?.slots || [], F) === 120,
  );
  r = await call("POST", "/pomodoro", {
    task: F,
    minutes: 60,
    today: "2030-05-01",
  });
  check(
    "a partial session keeps the task open",
    r.data?.updatedTask === null && r.data?.progress?.doneMinutes === 60,
  );
  r = await call("GET", `/slots?date=${D2}`);
  const leftF = minutes(
    r.data.filter((s) => s.status === "planned"),
    F,
  );
  check(
    "the plan shrinks toward the remaining time",
    leftF >= 60 && leftF < 120,
    String(leftF),
  );

  const G = await mk("G", 120);
  await call("POST", "/pomodoro", {
    task: G,
    minutes: 60,
    today: "2030-05-01",
  });
  r = await call("POST", "/slots/generate", {
    date: "2030-05-08",
    taskIds: [G],
    mode: "fill",
  });
  check(
    "later plans only need the remaining time",
    minutes(r.data?.slots || [], G) === 60,
  );

  section("Unfinished work moves to the next day");
  const H = await mk("H", 60);
  const T1 = "2030-06-03";
  const T2 = "2030-06-04";
  r = await call("POST", "/slots/generate", {
    date: T1,
    today: T1,
    now: "18:00",
    taskIds: [H],
    mode: "fill",
  });
  check(
    "H is planned this evening",
    r.data?.slots?.length === 1 && r.data.slots[0].start >= "18:00",
    JSON.stringify(r.data?.slots),
  );
  r = await call("POST", "/slots/generate", {
    date: T2,
    today: T1,
    now: "18:30",
    taskIds: [H],
    mode: "fill",
  });
  check(
    "while this evening's slot is still ahead, tomorrow gets nothing",
    r.data?.slots?.length === 0,
  );
  r = await call("POST", "/slots/generate", {
    date: T2,
    today: T1,
    now: "23:30",
    taskIds: [H],
    mode: "fill",
  });
  check(
    "once its time has passed, the work moves to tomorrow",
    minutes(r.data?.slots || [], H) === 60,
  );
  r = await call("GET", `/slots/missed?today=${T2}`);
  check(
    "the moved slot is not reported as missed again",
    r.data?.count === 0,
    JSON.stringify(r.data),
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error("\nCould not run the tests. Is the server running?");
  console.error(err.message);
  process.exit(1);
});
