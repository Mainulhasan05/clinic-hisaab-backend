/**
 * Standard response helper.
 *
 * EVERY API endpoint MUST use this function to send responses.
 * This ensures the frontend always receives the same JSON shape.
 *
 * Shape:
 *   { success: true/false, message: "...", data: {...} or null }
 *
 * HOW TO USE:
 *   sendResponse(res, 200, "Patients fetched successfully", patients);
 *   sendResponse(res, 201, "Patient created", newPatient);
 *   sendResponse(res, 200, "Patient deleted");  // no data
 */
const sendResponse = (res, statusCode, message, data = null) => {
  res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data,
  });
};

module.exports = sendResponse;
