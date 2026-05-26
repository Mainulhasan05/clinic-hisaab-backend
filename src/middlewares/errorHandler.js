/**
 * Global error handler middleware.
 *
 * WHAT IT DOES:
 * - Catches ALL errors thrown or passed via next(error) in the app.
 * - Converts known error types (Mongoose, JWT) into user-friendly messages.
 * - In development, sends the full error stack. In production, hides it.
 *
 * HOW IT WORKS:
 * Express knows this is an error handler because it has 4 parameters (err, req, res, next).
 * Any middleware that calls next(error) will skip to this handler.
 */

const errorHandler = (err, req, res, next) => {
  // Default values
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Log full error in development
  if (process.env.NODE_ENV === "development") {
    console.error("❌ ERROR:", err);
  } else {
    console.error("❌ ERROR:", err.message);
  }

  // --- Handle specific error types ---

  // Mongoose validation error (e.g., required field missing)
  if (err.name === "ValidationError") {
    statusCode = 400;
    const messages = Object.values(err.errors).map((val) => val.message);
    message = messages.join(". ");
  }

  // Mongoose cast error (e.g., invalid ObjectId format)
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose duplicate key error (e.g., email already exists)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for "${field}". This ${field} already exists.`;
  }

  // JWT invalid token
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Please log in again.";
  }

  // JWT expired token
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired. Please log in again.";
  }

  // Send the response
  res.status(statusCode).json({
    success: false,
    message,
    data: null,
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

module.exports = errorHandler;
