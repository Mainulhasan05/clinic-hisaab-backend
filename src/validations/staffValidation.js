const Joi = require("joi");
const { ROLES } = require("../utils/constants");

const createStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  password: Joi.string().min(6).max(128).required(),
  phone: Joi.string().trim().pattern(/^\d{5,15}$/).required(),
  role: Joi.string().valid(...ROLES).default("operator"),
});

const updateStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  phone: Joi.string().trim().pattern(/^\d{5,15}$/),
  role: Joi.string().valid(...ROLES),
  status: Joi.string().valid("active", "inactive"),
  password: Joi.string().min(6).max(128),
}).min(1);


module.exports = { createStaffSchema, updateStaffSchema };
