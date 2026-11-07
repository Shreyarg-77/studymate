import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw httpError(401, "Not logged in");

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, "Session expired, please log in again");
  }

  const user = await User.findById(payload.id);
  if (!user) throw httpError(401, "User no longer exists");

  req.user = user;
  next();
});

export default requireAuth;
