const Joi = require("joi");
const { ROLES } = require("../utils/constants");

const createStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  softwareAccess: Joi.boolean().default(true),
  password: Joi.when("softwareAccess", {
    is: false,
    then: Joi.string().allow("", null).optional(),
    otherwise: Joi.string().min(6).max(128).required(),
  }),
  phone: Joi.string().trim().pattern(/^01[3-9]\d{8}$/).required()
    .messages({ "string.pattern.base": "Staff phone must be a valid Bangladeshi 11-digit mobile number" }),
  role: Joi.string().valid(...ROLES).default("operator"),
  salary: Joi.number().min(0).default(0),
});

const updateStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  phone: Joi.string().trim().pattern(/^01[3-9]\d{8}$/)
    .messages({ "string.pattern.base": "Staff phone must be a valid Bangladeshi 11-digit mobile number" }),
  role: Joi.string().valid(...ROLES),
  status: Joi.string().valid("active", "inactive"),
  softwareAccess: Joi.boolean(),
  password: Joi.string().min(6).max(128).allow("", null),
  salary: Joi.number().min(0),
}).min(1);

const paySalarySchema = Joi.object({
  month: Joi.string().pattern(/^\d{4}-\d{2}$/).required()
    .messages({ "string.pattern.base": "Month must be in YYYY-MM format (e.g. 2026-05)" }),
  amount: Joi.number().min(1).required(),
});

module.exports = { createStaffSchema, updateStaffSchema, paySalarySchema };
