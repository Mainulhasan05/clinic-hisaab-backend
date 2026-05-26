/**
 * Authentication middleware — verifies the JWT token.
 *
 * WHAT IT DOES:
 * 1. Looks for "Authorization: Bearer <token>" in the request headers.
 * 2. Decodes the token to get the user's _id and role.
 * 3. Finds the user in the database.
 * 4. Attaches the user object to req.user so controllers can use it.
 *
 * If the token is missing, invalid, or expired — it rejects the request
 * with a 401 status code.
 *
 * USAGE IN ROUTES:
 *   router.get("/patients", authenticate, patientController.getAllPatients);
 */
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/AppError");

const authenticate = async (req, res, next) => {
  try {
    // Step 1: Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authentication required. Please log in.", 401);
    }

    // "Bearer abc123xyz" → "abc123xyz"
    const token = authHeader.split(" ")[1];

    // Step 2: Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 3: Find the user (without the password field)
    const user = await User.findById(decoded._id).select("-password");
    if (!user) {
      throw new AppError("User no longer exists. Please log in again.", 401);
    }

    // Step 4: Check if user account is active
    if (user.status !== "active") {
      throw new AppError("Your account has been deactivated.", 401);
    }

    // Step 5: Attach user to the request object
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;
