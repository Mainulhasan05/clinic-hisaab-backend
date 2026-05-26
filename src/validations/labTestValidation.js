const Joi = require("joi");

const createTestSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  price: Joi.number().min(0).required(),
  category: Joi.string().trim().max(100).default("General"),
});

const updateTestSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200),
  price: Joi.number().min(0),
  category: Joi.string().trim().max(100),
  isActive: Joi.boolean(),
}).min(1);

module.exports = { createTestSchema, updateTestSchema };
