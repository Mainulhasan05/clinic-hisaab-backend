/**
 * Activity logging service.
 * Called by other services after important actions (create, update, delete).
 */
const ActivityLog = require("../models/ActivityLog");

const logActivity = async ({ type, description, operator, operatorId, refId = null, refModel = null }) => {
  try {
    await ActivityLog.create({ type, description, operator, operatorId, refId, refModel });
  } catch (error) {
    // Activity logging should NEVER crash the main operation
    // If it fails, log the error but don't throw
    console.error("Failed to log activity:", error.message);
  }
};

module.exports = { logActivity };
