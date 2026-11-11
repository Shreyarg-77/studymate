import mongoose from "mongoose";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const blockedSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true, maxlength: 40 },
  start: { type: String, required: true, match: TIME },
  end: { type: String, required: true, match: TIME },
});

const settingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    dayStart: { type: String, default: "08:00", match: TIME },
    dayEnd: { type: String, default: "22:00", match: TIME },
    minSlotMins: { type: Number, default: 30 },
    maxSlotMins: { type: Number, default: 90 },
    breakMins: { type: Number, default: 10 },
    blockedTimes: { type: [blockedSchema], default: [] },
    briefingEnabled: { type: Boolean, default: true },
    briefingTime: { type: String, default: "07:00", match: TIME },
    slotRemindersEnabled: { type: Boolean, default: false },
    slotReminderLeadMins: { type: Number, default: 10 },
  },
  { timestamps: true },
);

export default mongoose.model("UserSettings", settingsSchema);
