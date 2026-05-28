const Joi = require("joi");
const { PATIENT_TYPES, GENDERS } = require("../utils/constants");

const createPatientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  age: Joi.number().integer().min(0).max(150).required(),
  gender: Joi.string().valid(...GENDERS).required(),
  phone: Joi.string().trim().pattern(/^01[3-9]\d{8}$/).required()
    .messages({ "string.pattern.base": "Patient phone must be a valid Bangladeshi 11-digit mobile number" }),
  address: Joi.string().trim().max(500).allow("").default(""),
  type: Joi.string().valid(...PATIENT_TYPES).default("lab"),
  admissionDate: Joi.date().allow(null).default(null),
  seatId: Joi.string().allow(null).default(null),
  guardianName: Joi.string().trim().allow(null, "").default(null),
  guardianPhone: Joi.string().trim().pattern(/^01[3-9]\d{8}$/).allow(null, "").default(null)
    .messages({ "string.pattern.base": "Guardian phone must be a valid Bangladeshi 11-digit mobile number" }),
  emergencyContact: Joi.string().trim().allow(null, "").default(null),
  advanceAmount: Joi.number().min(0).default(0),
  advancePaymentMethod: Joi.string().allow(null, "").default("Cash"),
  referenceDoctor: Joi.string().trim().allow(null, "").default(null),
  existingPatientId: Joi.string().allow(null, "").default(null),
  sendSms: Joi.boolean().default(false),
});

/**
 * Update patient schema — profile fields ONLY.
 *
 * INTENTIONALLY EXCLUDED:
 *   - status: managed by admit/discharge endpoints
 *   - seatId: managed by admit/discharge endpoints
 *   - type: derived from admission state, not directly editable
 *
 * The service layer also enforces these guards, but stripping them
 * at the validation layer means they never even reach the service.
 */
const updatePatientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200),
  age: Joi.number().integer().min(0).max(150),
  gender: Joi.string().valid(...GENDERS),
  phone: Joi.string().trim().pattern(/^01[3-9]\d{8}$/)
    .messages({ "string.pattern.base": "Patient phone must be a valid Bangladeshi 11-digit mobile number" }),
  address: Joi.string().trim().max(500).allow(""),
  guardianName: Joi.string().trim().allow(null, ""),
  guardianPhone: Joi.string().trim().pattern(/^01[3-9]\d{8}$/).allow(null, "")
    .messages({ "string.pattern.base": "Guardian phone must be a valid Bangladeshi 11-digit mobile number" }),
  emergencyContact: Joi.string().trim().allow(null, ""),
  referenceDoctor: Joi.string().trim().allow(null, ""),
}).min(1); // At least one field must be provided for an update

module.exports = { createPatientSchema, updatePatientSchema };
