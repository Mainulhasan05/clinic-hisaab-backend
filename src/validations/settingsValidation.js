const Joi = require("joi");

const updateSettingsSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200),
  address: Joi.string().trim().max(500).allow(""),
  phone: Joi.string().trim().max(20).allow(""),
  registrationNo: Joi.string().trim().max(100).allow(""),
  logoText: Joi.string().trim().max(10).allow(""),
}).min(1);


module.exports = { updateSettingsSchema };
