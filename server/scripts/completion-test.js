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

function section(title) {
  console.log(`\n${title}`);
}

const pad = (n) => String(n).padStart(2, "0");
function todayReportQuery() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `date=${date}&from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`;
}

async function run() {
  section("Setup");
  let r = await call("POST", "/auth/register", {
    name: "Completion User",
    email: `test${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`,
    password: "secret123",
  });
  check("register works", r.status === 201 && Boolean(r.data?.token));
  token = r.data?.token || "";

  r = await call("POST", "/subjects", { name: "Completion", type: "theory" });
  const subjectId = r.data?._id;

  const makeTask = async (title, estimatedMins) =>
    (
      await call("POST", "/tasks", {
        title,
        subject: subjectId,
        priority: "High",
        estimatedMins,
      })
    ).data?._id;
  const getTask = async (id) =>
    (await call("GET", "/tasks")).data.find((t) => t._id === id);
  const planFor = async (date, id) =>
    (await call("POST", "/slots/generate", { date, taskIds: [id] })).data
      ?.slots || [];

  section("A task finishes itself when all its minutes are done");
  const A = await makeTask("Two slots", 120);
  const dateA = "2030-03-04";
  const slotsA = (await planFor(dateA, A)).sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  check(
    "a 120-minute task is planned in two slots",
    slotsA.length === 2 && slotsA.reduce((n, s) => n + s.minutes, 0) === 120,
    JSON.stringify(slotsA.map((s) => s.minutes)),
  );

  r = await call("PATCH", `/slots/${slotsA[0]._id}`, { status: "done" });
  check(
    "first slot done: the response still has the slot fields",
    r.status === 200 &&
      r.data?.status === "done" &&
      typeof r.data?.minutes === "number",
  );
  check(
    "first slot done: the task is not complete yet",
    r.data?.updatedTask?.completed === false,
  );
  check(
    "the Tasks list still shows it as pending",
    (await getTask(A))?.completed === false,
  );

  r = await call("PATCH", `/slots/${slotsA[1]._id}`, { status: "done" });
  check(
    "last slot done: the task completes itself",
    r.data?.updatedTask?.completed === true &&
      r.data?.updatedTask?.autoCompleted === true &&
      Boolean(r.data?.updatedTask?.completedAt),
  );
  check(
    "the Tasks list now shows it completed",
    (await getTask(A))?.completed === true,
  );

  r = await call("GET", `/slots?date=${dateA}`);
  check(
    "done slots are kept on the server for the report",
    r.data.filter((s) => s.status === "done").length === 2,
  );

  r = await call("GET", `/report?${todayReportQuery()}`);
  check(
    "the finished task appears in today's report",
    Boolean(r.data?.completedTasks?.some((t) => t._id === A)),
    r.data?.message || "",
  );

  section("Undo reopens a task that finished itself");
  r = await call("PATCH", `/slots/${slotsA[1]._id}`, { status: "planned" });
  check(
    "undoing the last slot reopens the task",
    r.data?.updatedTask?.completed === false &&
      r.data?.updatedTask?.completedAt === null,
  );
  check(
    "the Tasks list shows it pending again",
    (await getTask(A))?.completed === false,
  );

  r = await call("PATCH", `/slots/${slotsA[1]._id}`, { status: "done" });
  check(
    "marking it done again completes it",
    r.data?.updatedTask?.completed === true,
  );

  r = await call("PUT", `/tasks/${A}`, { completed: false });
  check(
    "ticking the task off by hand makes it a manual change",
    r.status === 200 &&
      r.data?.completed === false &&
      r.data?.autoCompleted === false,
  );

  section("Skipping does not finish a task");
  const C = await makeTask("One slot", 60);
  const dateC = "2030-03-06";
  const slotsC = await planFor(dateC, C);
  check(
    "a 60-minute task is one slot",
    slotsC.length === 1 && slotsC[0].minutes === 60,
  );
  r = await call("PATCH", `/slots/${slotsC[0]._id}`, { status: "skipped" });
  check(
    "skipping leaves the task pending",
    r.data?.updatedTask?.completed === false,
  );
  r = await call("PATCH", `/slots/${slotsC[0]._id}`, { status: "done" });
  check(
    "a single done slot completes a short task",
    r.data?.updatedTask?.completed === true,
  );

  section("Completing by hand is never undone by a slot");
  const B = await makeTask("Manual", 120);
  const dateB = "2030-03-05";
  const slotsB = (await planFor(dateB, B)).sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  r = await call("PATCH", `/slots/${slotsB[0]._id}`, { status: "done" });
  check(
    "one slot done, task still pending",
    r.data?.updatedTask?.completed === false,
  );
  r = await call("PUT", `/tasks/${B}`, { completed: true });
  check(
    "ticking it complete by hand works",
    r.status === 200 && r.data?.completed === true,
  );
  r = await call("GET", `/slots?date=${dateB}`);
  check(
    "its unfinished slots were removed",
    r.data.every((s) => s.status === "done"),
  );
  r = await call("PATCH", `/slots/${slotsB[0]._id}`, { status: "planned" });
  check(
    "undoing a slot does not reopen a manually completed task",
    r.data?.updatedTask?.completed === true,
  );

  section("Another user");
  const firstToken = token;
  r = await call("POST", "/auth/register", {
    name: "Other Completion User",
    email: `other${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`,
    password: "secret123",
  });
  token = r.data?.token || "";
  r = await call("PATCH", `/slots/${slotsA[0]._id}`, { status: "planned" });
  check("another user cannot change the slot", r.status === 404);
  token = firstToken;
  check(
    "the owner's task is unchanged",
    (await getTask(A))?.completed === false,
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error("\nCould not run the tests. Is the server running?");
  console.error(err.message);
  process.exit(1);
});
