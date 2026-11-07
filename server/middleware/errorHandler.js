export function errorHandler(err, req, res, next) {
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
  console.error(err);
  res.status(500).json({ message: "Server error" });
}
