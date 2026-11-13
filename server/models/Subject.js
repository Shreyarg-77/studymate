import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
      maxlength: [40, "Subject name can be at most 40 characters"],
    },
    type: { type: String, enum: ["theory", "practical"], default: "theory" },
    color: {
      type: String,
      default: "#4F46E5",
      match: [/^#[0-9a-fA-F]{6}$/, "Color must look like #4F46E5"],
    },
  },
  { timestamps: true },
);

export default mongoose.model("Subject", subjectSchema);
