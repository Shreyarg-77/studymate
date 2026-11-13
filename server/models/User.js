import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [60, "Name can be at most 60 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email can be at most 254 characters"],
      match: [/^\S+@\S+\.\S+$/, "Enter a valid email"],
    },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
