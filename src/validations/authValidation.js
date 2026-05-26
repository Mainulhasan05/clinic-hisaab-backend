const Joi = require("joi");

// Used for first-time setup (creates the owner account + settings)
const setupSchema = Joi.object({
  nursingHomeName: Joi.string().trim().min(2).max(200).required()
    .messages({ "any.required": "Nursing home name is required" }),
  ownerName: Joi.string().trim().min(2).max(100).required()
    .messages({ "any.required": "Owner name is required" }),
  email: Joi.string().trim().email().required()
    .messages({ "any.required": "Email is required", "string.email": "Invalid email format" }),
  password: Joi.string().min(6).max(128).required()
    .messages({ "any.required": "Password is required", "string.min": "Password must be at least 6 characters" }),
});

// Used for login
const loginSchema = Joi.object({
  email: Joi.string().trim().email().required()
    .messages({ "any.required": "Email is required" }),
  password: Joi.string().required()
    .messages({ "any.required": "Password is required" }),
});

module.exports = { setupSchema, loginSchema };
