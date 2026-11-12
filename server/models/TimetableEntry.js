import mongoose from "mongoose";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const timetableSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
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
    room: {
      type: String,
      default: "",
      trim: true,
      maxlength: [30, "Room can be at most 30 characters"],
    },
  },
  { timestamps: true },
);

export default mongoose.model("TimetableEntry", timetableSchema);
