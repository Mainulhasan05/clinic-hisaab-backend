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

// Used to request password reset OTP
const forgotPasswordSchema = Joi.object({
  phone: Joi.string().trim().pattern(/^01[3-9]\d{8}$/).required()
    .messages({
      "any.required": "Phone number is required",
      "string.pattern.base": "Must be a valid Bangladeshi 11-digit mobile number",
    }),
});

// Used to verify OTP and reset password
const resetPasswordSchema = Joi.object({
  phone: Joi.string().trim().pattern(/^01[3-9]\d{8}$/).required()
    .messages({
      "any.required": "Phone number is required",
      "string.pattern.base": "Must be a valid Bangladeshi 11-digit mobile number",
    }),
  otp: Joi.string().trim().length(6).pattern(/^\d+$/).required()
    .messages({
      "any.required": "OTP code is required",
      "string.length": "OTP must be exactly 6 digits",
      "string.pattern.base": "OTP must contain only digits",
    }),
  newPassword: Joi.string().min(6).max(128).required()
    .messages({
      "any.required": "New password is required",
      "string.min": "Password must be at least 6 characters",
    }),
});

// Used to update own profile (name, password)
const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  currentPassword: Joi.string().min(1),
  newPassword: Joi.string().min(6).max(128)
    .messages({ "string.min": "New password must be at least 6 characters" }),
}).min(1).with("newPassword", "currentPassword")
  .messages({ "object.with": "Current password is required to set a new password" });

module.exports = { setupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema };
