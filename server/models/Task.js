import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: [true, "Title is required"], trim: true },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
    },
    category: {
      type: String,
      enum: ["Assignment", "Tutorial", "Homework", "Practical"],
      default: "Assignment",
    },
    dueDate: { type: String, default: "" },
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
    },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("Task", taskSchema);
