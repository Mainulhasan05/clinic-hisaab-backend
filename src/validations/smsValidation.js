const Joi = require("joi");

const sendSmsSchema = Joi.object({
  recipient: Joi.string().pattern(/^880\d{10}$/).required().messages({
    "string.pattern.base": "Phone number must be in Bangladeshi international format without '+' (e.g. 88017XXXXXXXX)"
  }),
  message: Joi.string().min(1).max(1000).required(),
  type: Joi.string().valid("manual", "marketing").default("manual"),
});

const sendBulkSmsSchema = Joi.object({
  recipients: Joi.array().items(
    Joi.string().pattern(/^880\d{10}$/).required().messages({
      "string.pattern.base": "Each phone number must be in Bangladeshi international format without '+' (e.g. 88017XXXXXXXX)"
    })
  ).min(1).max(500).required(),
  message: Joi.string().min(1).max(1000).required(),
  type: Joi.string().valid("manual", "marketing").default("marketing"),
  campaignId: Joi.string().allow(null, "").optional()
});

const sendDynamicSmsSchema = Joi.object({
  smsData: Joi.array().items(
    Joi.object({
      recipient: Joi.string().pattern(/^880\d{10}$/).required().messages({
        "string.pattern.base": "Phone number must be in Bangladeshi international format without '+' (e.g. 88017XXXXXXXX)"
      }),
      message: Joi.string().min(1).max(1000).required()
    })
  ).min(1).max(500).required(),
  type: Joi.string().valid("manual", "marketing").default("marketing")
});

module.exports = {
  sendSmsSchema,
  sendBulkSmsSchema,
  sendDynamicSmsSchema
};
