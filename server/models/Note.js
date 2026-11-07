import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, default: "", trim: true },
    content: { type: String, default: "" },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("Note", noteSchema);
