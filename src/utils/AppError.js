/**
 * Custom error class for operational errors.
 *
 * WHAT IT DOES:
 * - Extends the built-in Error class.
 * - Adds a `statusCode` property (e.g., 400, 404, 500).
 * - Adds `isOperational` flag to distinguish from programming bugs.
 *
 * HOW TO USE:
 *   throw new AppError("Patient not found", 404);
 *   throw new AppError("Email already exists", 409);
 *   throw new AppError("Invalid input", 400);
 */
class AppError extends Error {
  constructor(message, statusCode) {
    // Call the parent Error constructor with the message
    super(message);

    // HTTP status code (200, 400, 401, 403, 404, 409, 500)
    this.statusCode = statusCode;

    // Operational = expected errors (bad input, not found, etc.)
    // Programming bugs will NOT have this flag
    this.isOperational = true;

    // Capture the stack trace, excluding this constructor from it
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
