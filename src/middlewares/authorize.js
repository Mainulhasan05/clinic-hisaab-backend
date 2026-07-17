/**
 * Authorization middleware — checks if the user has the required role.
 *
 * This is a FACTORY FUNCTION: you call it with the allowed roles,
 * and it returns a middleware function.
 *
 * USAGE IN ROUTES:
 *   router.delete("/patients/:id", authenticate, authorize("owner", "manager"), deletePatient);
 *   router.post("/staff", authenticate, authorize("owner"), createStaff);
 *
 * HOW IT WORKS:
 *   authorize("owner", "manager") returns a middleware that checks:
 *   → Is req.user.role "owner" OR "manager"?
 *   → If yes: call next() to proceed.
 *   → If no: throw a 403 Forbidden error.
 */
const AppError = require("../utils/AppError");

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required.", 401));
    }

    // Owner always has full access (wildcard permission)
    if (req.user.role === "owner" || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return next(
      new AppError(
        `Access denied. Required role: ${allowedRoles.join(" or ")}. Your role: ${req.user.role}.`,
        403
      )
    );
  };
};

module.exports = authorize;
