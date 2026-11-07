import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
    },
    type: { type: String, enum: ["theory", "practical"], default: "theory" },
    color: { type: String, default: "#4F46E5" },
  },
  { timestamps: true },
);

export default mongoose.model("Subject", subjectSchema);
