import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import requireAuth from "./middleware/auth.js";
import sanitizeInput from "./middleware/sanitize.js";
import authRoutes from "./routes/authRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import timetableRoutes from "./routes/timetableRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import pomodoroRoutes from "./routes/pomodoroRoutes.js";
import slotRoutes from "./routes/slotRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const secret = process.env.JWT_SECRET || "";
if (secret.length < 32 || secret.includes("replace-this")) {
  console.error(
    "JWT_SECRET is missing, shorter than 32 characters, or still the placeholder.\n" +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
  process.exit(1);
}

const allowedOrigins = (
  process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (process.env.NODE_ENV === "production" && !process.env.CLIENT_ORIGIN) {
  console.warn(
    "CLIENT_ORIGIN is not set, so only localhost is allowed by CORS.",
  );
}

const app = express();

// Render sits behind a proxy, so trust the first hop to see real client IPs.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (scripts, curl) are not browser requests.
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      callback(null, false);
    },
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(sanitizeInput);

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Failed login and register attempts per network address.
const authIpLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please wait 15 minutes and try again.",
  },
});

// Failed attempts per email, so one account cannot be guessed from many addresses.
const authEmailLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: Number(process.env.AUTH_EMAIL_LIMIT_MAX) || 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) =>
    `email:${String(req.body?.email || "")
      .toLowerCase()
      .trim()
      .slice(0, 254)}`,
  message: {
    message: "Too many attempts for this account. Please wait 15 minutes.",
  },
});

// Requests per signed-in user, so students sharing one college network do not block each other.
const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT_PER_MIN) || 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: {
    message: "You are sending requests too quickly. Please slow down.",
  },
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "StudyMate API" });
});

app.use("/api/auth/login", authIpLimiter, authEmailLimiter);
app.use("/api/auth/register", authIpLimiter, authEmailLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/subjects", requireAuth, userLimiter, subjectRoutes);
app.use("/api/tasks", requireAuth, userLimiter, taskRoutes);
app.use("/api/timetable", requireAuth, userLimiter, timetableRoutes);
app.use("/api/notes", requireAuth, userLimiter, noteRoutes);
app.use("/api/pomodoro", requireAuth, userLimiter, pomodoroRoutes);
app.use("/api/slots", requireAuth, userLimiter, slotRoutes);
app.use("/api/settings", requireAuth, userLimiter, settingsRoutes);
app.use("/api/report", requireAuth, userLimiter, reportRoutes);

app.use("/api", (req, res) => res.status(404).json({ message: "Not found" }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
