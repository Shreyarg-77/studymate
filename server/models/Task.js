import mongoose from "mongoose";

function isValidDueDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [120, "Title can be at most 120 characters"],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
    },
    category: {
      type: String,
      enum: [
        "Assignment",
        "Tutorial",
        "Homework",
        "Practical",
        "Revision",
        "Project",
        "Practice",
        "Reading",
        "Other",
      ],
      default: "Assignment",
    },
    dueDate: {
      type: String,
      default: "",
      validate: {
        validator: isValidDueDate,
        message: "Due date must be a real date in YYYY-MM-DD format",
      },
    },
    priority: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
    },
    estimatedMins: {
      type: Number,
      default: 60,
      min: [5, "Estimate must be at least 5 minutes"],
      max: [600, "Estimate can be at most 600 minutes"],
      validate: {
        validator: Number.isInteger,
        message: "Estimate must be a whole number of minutes",
      },
    },
    // Optional: the most minutes the plan may give this task in one day.
    dailyMins: {
      type: Number,
      default: null,
      min: [15, "Daily limit must be at least 15 minutes"],
      max: [600, "Daily limit can be at most 600 minutes"],
      validate: {
        validator: (v) => v == null || Number.isInteger(v),
        message: "Daily limit must be a whole number of minutes",
      },
    },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    autoCompleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("Task", taskSchema);
