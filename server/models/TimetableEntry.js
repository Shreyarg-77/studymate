import mongoose from "mongoose";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const timetableSchema = new mongoose.Schema(
  {
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
    },
    day: { type: Number, min: 0, max: 6, required: [true, "Day is required"] },
    start: {
      type: String,
      required: [true, "Start time is required"],
      match: [TIME, "Start time must be HH:mm"],
    },
    end: {
      type: String,
      required: [true, "End time is required"],
      match: [TIME, "End time must be HH:mm"],
    },
    room: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

export default mongoose.model("TimetableEntry", timetableSchema);
