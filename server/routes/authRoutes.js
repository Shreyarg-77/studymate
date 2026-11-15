import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "11111111",
  "00000000",
  "qwertyui",
  "qwerty123",
  "iloveyou",
  "admin123",
  "welcome1",
  "letmein1",
  "abc12345",
  "studymate",
  "student123",
  "college123",
  "changeme",
]);

// Compared when the email is unknown, so a missing account answers as slowly
// as a wrong password and response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

function signToken(user) {
  return jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN || "2d",
  });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

function checkPassword(password, email) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw httpError(400, "Password must be 8 to 72 characters");
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(password)) {
    throw httpError(
      400,
      "That password is too common. Choose one that is harder to guess",
    );
  }
  if (lower === String(email).toLowerCase().trim()) {
    throw httpError(400, "Your password cannot be the same as your email");
  }
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
    checkPassword(password, email);

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
      typeof password === "string" &&
      (await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH));
    if (!user || !ok) throw httpError(401, "Invalid email or password");

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
