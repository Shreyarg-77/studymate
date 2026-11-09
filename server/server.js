import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import requireAuth from "./middleware/auth.js";
import authRoutes from "./routes/authRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import timetableRoutes from "./routes/timetableRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import pomodoroRoutes from "./routes/pomodoroRoutes.js";
import slotRoutes from "./routes/slotRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 20) {
  console.error("JWT_SECRET is missing or too short in server/.env");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "StudyMate API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/subjects", requireAuth, subjectRoutes);
app.use("/api/tasks", requireAuth, taskRoutes);
app.use("/api/timetable", requireAuth, timetableRoutes);
app.use("/api/notes", requireAuth, noteRoutes);
app.use("/api/pomodoro", requireAuth, pomodoroRoutes);
app.use("/api/slots", requireAuth, slotRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
