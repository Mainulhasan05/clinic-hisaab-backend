const Joi = require("joi");
const { PATIENT_TYPES, GENDERS } = require("../utils/constants");

const createPatientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  age: Joi.number().integer().min(0).max(150).required(),
  gender: Joi.string().valid(...GENDERS).required(),
  phone: Joi.string().trim().min(5).max(20).required(),
  address: Joi.string().trim().max(500).allow("").default(""),
  type: Joi.string().valid(...PATIENT_TYPES).default("lab"),
  admissionDate: Joi.date().allow(null).default(null),
  seatId: Joi.string().allow(null).default(null),
  guardianName: Joi.string().trim().allow(null, "").default(null),
  guardianPhone: Joi.string().trim().allow(null, "").default(null),
  emergencyContact: Joi.string().trim().allow(null, "").default(null),
  referenceDoctor: Joi.string().trim().allow(null, "").default(null),
});

const updatePatientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200),
  age: Joi.number().integer().min(0).max(150),
  gender: Joi.string().valid(...GENDERS),
  phone: Joi.string().trim().min(5).max(20),
  address: Joi.string().trim().max(500).allow(""),
  type: Joi.string().valid(...PATIENT_TYPES),
  admissionDate: Joi.date().allow(null),
  seatId: Joi.string().allow(null),
  guardianName: Joi.string().trim().allow(null, ""),
  guardianPhone: Joi.string().trim().allow(null, ""),
  emergencyContact: Joi.string().trim().allow(null, ""),
  referenceDoctor: Joi.string().trim().allow(null, ""),
  status: Joi.string().valid("active", "admitted", "discharged"),
}).min(1); // At least one field must be provided for an update

module.exports = { createPatientSchema, updatePatientSchema };
