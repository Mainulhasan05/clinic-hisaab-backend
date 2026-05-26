/**
 * Validation middleware factory — validates req.body using a Joi schema.
 *
 * WHAT IS JOI?
 * Joi is a library that lets you define rules for data.
 * Example: "name must be a string, required, minimum 2 characters".
 * If the data doesn't match the rules, Joi returns a clear error message.
 *
 * USAGE IN ROUTES:
 *   const { createPatientSchema } = require("../validations/patientValidation");
 *   router.post("/patients", authenticate, validate(createPatientSchema), createPatient);
 *
 * HOW IT WORKS:
 *   1. Takes the Joi schema as input.
 *   2. Returns a middleware function.
 *   3. The middleware validates req.body against the schema.
 *   4. If valid: replaces req.body with the cleaned/validated data, calls next().
 *   5. If invalid: throws a 400 error with the first error message.
 */
const AppError = require("../utils/AppError");

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: true,      // Stop at the first error
      stripUnknown: true,     // Remove fields not in the schema
      allowUnknown: false,    // Don't allow unknown fields
    });

    if (error) {
      const message = error.details[0].message.replace(/"/g, "");
      return next(new AppError(message, 400));
    }

    // Replace req.body with the validated and cleaned data
    req.body = value;
    next();
  };
};

module.exports = validate;
