const Joi = require("joi");

const createSeatSchema = Joi.object({
  roomName: Joi.string().trim().min(1).max(100).required(),
  bedName: Joi.string().trim().min(1).max(100).required(),
  dailyRate: Joi.number().min(0).required(),
});

const updateSeatSchema = Joi.object({
  roomName: Joi.string().trim().min(1).max(100),
  bedName: Joi.string().trim().min(1).max(100),
  dailyRate: Joi.number().min(0),
}).min(1);

module.exports = { createSeatSchema, updateSeatSchema };
