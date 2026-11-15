import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) throw httpError(401, "Not logged in");

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    throw httpError(401, "Session expired, please log in again");
  }
  if (typeof payload.id !== "string" || !OBJECT_ID.test(payload.id)) {
    throw httpError(401, "Session expired, please log in again");
  }

  const user = await User.findById(payload.id).select("-passwordHash");
  if (!user) throw httpError(401, "User no longer exists");

  req.user = user;
  next();
});

export default requireAuth;
