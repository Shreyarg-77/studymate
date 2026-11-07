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

async function run() {
  const email = `test${Date.now()}@example.com`;

  section("Health");
  let r = await call("GET", "/health");
  check("health check returns 200", r.status === 200);

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
  });
  check("create task returns 201", r.status === 201 && Boolean(r.data?._id));
  const taskId = r.data?._id;

  r = await call("POST", "/tasks", { subject: subjectId });
  check("task without a title returns 400", r.status === 400);

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
