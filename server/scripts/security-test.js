import http from "node:http";
import https from "node:https";

const BASE = process.env.API_URL || "http://localhost:5000/api";
const ALLOWED_ORIGIN =
  process.env.TEST_ALLOWED_ORIGIN || "http://localhost:5173";
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE);

let passed = 0;
let failed = 0;

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

async function call(method, path, body, token) {
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
  return { status: res.status, data, headers: res.headers };
}

async function raw(method, path, rawBody, extraHeaders = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: rawBody,
  });
  return { status: res.status };
}

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

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

async function run() {
  section("Headers and CORS");
  let r = await call("GET", "/health");
  check(
    "nosniff header is set",
    r.headers.get("x-content-type-options") === "nosniff",
  );
  check(
    "HSTS header is set",
    Boolean(r.headers.get("strict-transport-security")),
  );
  check(
    "server does not advertise Express",
    r.headers.get("x-powered-by") === null,
  );
  check(
    "allowed origin passes CORS",
    (await corsHeaderFor(ALLOWED_ORIGIN)) === ALLOWED_ORIGIN,
  );
  check(
    "unknown origin is refused by CORS",
    (await corsHeaderFor("https://evil.example.com")) === null,
  );

  section("Injection attempts");
  r = await call("POST", "/auth/login", {
    email: { $ne: null },
    password: { $ne: null },
  });
  check(
    "login with operator objects is rejected",
    r.status === 400,
    `got ${r.status}`,
  );
  r = await call("POST", "/auth/register", {
    name: { $gt: "" },
    email: `inj${Date.now()}@example.com`,
    password: "Sup3rSecret!",
  });
  check("register with operator objects is rejected", r.status === 400);
  r = await raw("GET", "/slots?date[$ne]=x");
  check("operator in a query string is rejected", r.status === 400);
  r = await raw(
    "POST",
    "/auth/login",
    '{"email":"a@b.com","password":"x","__proto__":{"admin":true}}',
  );
  check("__proto__ key is rejected", r.status === 400);

  section("Passwords");
  const stamp = Date.now();
  r = await call("POST", "/auth/register", {
    name: "Pw",
    email: `pw1${stamp}@example.com`,
    password: "password123",
  });
  check("a common password is rejected", r.status === 400);
  r = await call("POST", "/auth/register", {
    name: "Pw",
    email: `pw2${stamp}@example.com`,
    password: "12345678",
  });
  check("12345678 is rejected", r.status === 400);
  r = await call("POST", "/auth/register", {
    name: "Pw",
    email: `pw3${stamp}@example.com`,
    password: "aaaaaaaa",
  });
  check("a repeated character is rejected", r.status === 400);
  r = await call("POST", "/auth/register", {
    name: "Pw",
    email: `pw4${stamp}@example.com`,
    password: "Short7!",
  });
  check("7 characters are rejected", r.status === 400);
  const sameAsEmail = `pw5${stamp}@example.com`;
  r = await call("POST", "/auth/register", {
    name: "Pw",
    email: sameAsEmail,
    password: sameAsEmail,
  });
  check("password equal to the email is rejected", r.status === 400);

  r = await call("POST", "/auth/register", {
    name: "Secure User",
    email: `sec${stamp}@example.com`,
    password: "Tr0ub4dor&3",
  });
  check(
    "a strong password is accepted",
    r.status === 201 && Boolean(r.data?.token),
  );
  check(
    "register response has no password hash",
    !JSON.stringify(r.data).includes("passwordHash"),
  );
  const token = r.data?.token || "";
  const userId = r.data?.user?.id || "";

  r = await call("GET", "/auth/me", undefined, token);
  check(
    "/me works and has no password hash",
    r.status === 200 && !JSON.stringify(r.data).includes("passwordHash"),
  );

  section("Token tampering");
  const [header, , signature] = token.split(".");
  r = await call(
    "GET",
    "/auth/me",
    undefined,
    `${header}.${b64({ id: "0".repeat(24) })}.${signature}`,
  );
  check("a forged payload is rejected", r.status === 401);
  r = await call(
    "GET",
    "/auth/me",
    undefined,
    `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: userId })}.`,
  );
  check("a token with alg none is rejected", r.status === 401);
  r = await call("GET", "/auth/me", undefined, "abc.def.ghi");
  check("garbage is rejected", r.status === 401);
  r = await raw("GET", "/auth/me", undefined, {
    Authorization: "Basic dXNlcjpwYXNz",
  });
  check("a non-Bearer scheme is rejected", r.status === 401);

  section("Every data route needs a login");
  const day = "2030-01-07";
  const protectedGets = [
    "/subjects",
    "/tasks",
    "/timetable",
    "/notes",
    "/pomodoro",
    "/settings",
    `/slots?date=${day}`,
    `/slots/missed?today=${day}`,
    `/report?date=${day}&from=${day}T00:00:00Z&to=2030-01-08T00:00:00Z`,
  ];
  for (const path of protectedGets) {
    r = await call("GET", path);
    check(
      `GET ${path.split("?")[0]} without a token returns 401`,
      r.status === 401,
      `got ${r.status}`,
    );
  }
  r = await call("POST", "/slots/generate", { date: day });
  check("POST /slots/generate without a token returns 401", r.status === 401);

  section("Limits and unknown paths");
  r = await call("GET", "/does-not-exist");
  check(
    "an unknown API path returns a JSON 404",
    r.status === 404 && typeof r.data?.message === "string",
  );
  r = await call("POST", "/auth/login", {
    email: "a@b.com",
    password: "x".repeat(200000),
  });
  check("a body over 100 kb returns 413", r.status === 413, `got ${r.status}`);

  if (LOCAL) {
    section("Account lockout (local only)");
    const victim = `lock${stamp}@example.com`;
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      const attempt = await call("POST", "/auth/login", {
        email: victim,
        password: "wrong-password",
      });
      statuses.push(attempt.status);
    }
    check(
      "the first 10 wrong passwords return 401",
      statuses.slice(0, 10).every((s) => s === 401),
      statuses.join(","),
    );
    check(
      "the 11th attempt is locked out with 429",
      statuses[10] === 429,
      statuses.join(","),
    );
  } else {
    console.log(
      "\nAccount lockout test skipped (it would use up the real server's failed-login allowance).",
    );
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error("\nCould not run the tests. Is the server running?");
  console.error(err.message);
  process.exit(1);
});
