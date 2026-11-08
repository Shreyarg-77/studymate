import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    minutes: { type: Number, required: true, min: 1, max: 180 },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.model("PomodoroSession", sessionSchema);
