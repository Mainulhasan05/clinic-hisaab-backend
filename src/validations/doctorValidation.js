const Joi = require("joi");

const createDoctorSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  degrees: Joi.string().trim().allow("").max(200),
  designation: Joi.string().trim().allow("").max(100),
  workplace: Joi.string().trim().allow("").max(200),
  phone: Joi.string().trim().allow("").max(20),
});

const updateDoctorSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  degrees: Joi.string().trim().allow("").max(200),
  designation: Joi.string().trim().allow("").max(100),
  workplace: Joi.string().trim().allow("").max(200),
  phone: Joi.string().trim().allow("").max(20),
  isActive: Joi.boolean(),
}).min(1);

module.exports = { createDoctorSchema, updateDoctorSchema };
