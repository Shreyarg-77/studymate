import Subject from "../models/Subject.js";
import Task from "../models/Task.js";
import httpError from "./httpError.js";

export async function assertOwnsSubject(subjectId, userId) {
  if (!subjectId) return;
  const found = await Subject.exists({ _id: subjectId, user: userId });
  if (!found) throw httpError(404, "Subject not found");
}

export async function assertOwnsTask(taskId, userId) {
  if (!taskId) return;
  const found = await Task.exists({ _id: taskId, user: userId });
  if (!found) throw httpError(404, "Task not found");
}
