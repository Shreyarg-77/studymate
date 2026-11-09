import mongoose from "mongoose";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const slotSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    date: {
      type: String,
      required: true,
      match: [DATE, "Date must be YYYY-MM-DD"],
    },
    start: {
      type: String,
      required: true,
      match: [TIME, "Start must be HH:mm"],
    },
    end: { type: String, required: true, match: [TIME, "End must be HH:mm"] },
    minutes: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["planned", "done", "skipped"],
      default: "planned",
    },
  },
  { timestamps: true },
);

slotSchema.index({ user: 1, date: 1 });

export default mongoose.model("StudySlot", slotSchema);
