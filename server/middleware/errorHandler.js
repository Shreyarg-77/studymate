export function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ message: "The request contained invalid JSON" });
  }
  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
    return res.status(400).json({ message });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid id" });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "That value is already in use" });
  }
  console.error(err);
  res.status(500).json({ message: "Server error" });
}
