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

async function run() {
  section("Personal subjects and categories");
  let r = await call("POST", "/auth/register", {
    name: "Personal User",
    email: `test${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`,
    password: "secret123",
  });
  check("register works", r.status === 201 && Boolean(r.data?.token));
  token = r.data?.token || "";

  r = await call("POST", "/subjects", {
    name: "Aptitude practice",
    type: "personal",
  });
  check(
    "a personal subject can be created",
    r.status === 201 && r.data?.type === "personal",
  );
  const personalId = r.data?._id;

  r = await call("POST", "/subjects", { name: "Weird", type: "other" });
  check("an unknown subject type returns 400", r.status === 400);

  r = await call("POST", "/subjects", {
    name: "Operating Systems",
    type: "theory",
  });
  const theoryId = r.data?._id;

  r = await call("POST", "/tasks", {
    title: "Quant set 1",
    subject: personalId,
    category: "Practice",
    estimatedMins: 45,
  });
  check(
    "a Practice task under a personal subject is accepted",
    r.status === 201 && r.data?.category === "Practice",
  );
  const personalTask = r.data?._id;

  r = await call("POST", "/tasks", {
    title: "Build app",
    subject: personalId,
    category: "Project",
  });
  check("a Project task is accepted", r.status === 201);

  r = await call("POST", "/tasks", {
    title: "Revise unit 2",
    subject: theoryId,
    category: "Revision",
  });
  check("Revision is accepted for a class subject", r.status === 201);

  r = await call("POST", "/tasks", {
    title: "Bad",
    subject: personalId,
    category: "Bogus",
  });
  check("an unknown category returns 400", r.status === 400);

  r = await call("POST", "/slots/generate", {
    date: "2030-04-02",
    taskIds: [personalTask],
  });
  check(
    "a personal task is planned like any other",
    r.status === 200 &&
      r.data?.slots?.length > 0 &&
      r.data.slots.every((s) => s.task === personalTask),
    r.data?.message || "",
  );

  r = await call("POST", "/timetable", {
    subject: personalId,
    days: [1],
    start: "09:00",
    end: "10:00",
  });
  check(
    "a personal subject cannot be added to the timetable",
    r.status === 400,
    r.data?.message || "",
  );

  r = await call("POST", "/timetable", {
    subject: theoryId,
    days: [1],
    start: "09:00",
    end: "10:00",
  });
  check(
    "a class subject can still be added to the timetable",
    r.status === 201,
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error("\nCould not run the tests. Is the server running?");
  console.error(err.message);
  process.exit(1);
});
