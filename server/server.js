import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import requireAuth from "./middleware/auth.js";
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

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 20) {
  console.error("JWT_SECRET is missing or too short in server/.env");
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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please wait 15 minutes and try again.",
  },
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "StudyMate API" });
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/subjects", requireAuth, subjectRoutes);
app.use("/api/tasks", requireAuth, taskRoutes);
app.use("/api/timetable", requireAuth, timetableRoutes);
app.use("/api/notes", requireAuth, noteRoutes);
app.use("/api/pomodoro", requireAuth, pomodoroRoutes);
app.use("/api/slots", requireAuth, slotRoutes);
app.use("/api/settings", requireAuth, settingsRoutes);
app.use("/api/report", requireAuth, reportRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
