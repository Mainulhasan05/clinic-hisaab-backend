const Joi = require("joi");

// Used for first-time setup (creates the owner account + settings)
const setupSchema = Joi.object({
  nursingHomeName: Joi.string().trim().min(2).max(200).required()
    .messages({ "any.required": "Nursing home name is required" }),
  ownerName: Joi.string().trim().min(2).max(100).required()
    .messages({ "any.required": "Owner name is required" }),
  phone: Joi.string().trim().pattern(/^01[3-9]\d{8}$/).required()
    .messages({ "any.required": "Phone is required", "string.pattern.base": "Must be a valid Bangladeshi 11-digit mobile number" }),
  password: Joi.string().min(6).max(128).required()
    .messages({ "any.required": "Password is required", "string.min": "Password must be at least 6 characters" }),
});

// Used for login
const loginSchema = Joi.object({
  phone: Joi.string().trim().required()
    .messages({ "any.required": "Phone is required" }),
  password: Joi.string().required()
    .messages({ "any.required": "Password is required" }),
});


module.exports = { setupSchema, loginSchema };
