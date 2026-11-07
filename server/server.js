import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "StudyMate API" });
});

app.use("/api/subjects", subjectRoutes);
app.use("/api/tasks", taskRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
