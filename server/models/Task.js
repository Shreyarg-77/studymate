import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
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
    completed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("Task", taskSchema);
