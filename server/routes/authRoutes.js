import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (typeof name !== "string" || !name.trim()) {
      throw httpError(400, "Name is required");
    }
    if (typeof email !== "string" || !email.trim()) {
      throw httpError(400, "Email is required");
    }
    if (
      typeof password !== "string" ||
      password.length < 6 ||
      password.length > 72
    ) {
      throw httpError(400, "Password must be 6 to 72 characters");
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) throw httpError(409, "Email already registered");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({
      email: String(email || "")
        .toLowerCase()
        .trim(),
    });
    const ok =
      user &&
      typeof password === "string" &&
      (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw httpError(401, "Invalid email or password");

    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  }),
);

export default router;
