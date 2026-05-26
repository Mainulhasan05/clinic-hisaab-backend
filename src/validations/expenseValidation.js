const Joi = require("joi");
const { EXPENSE_CATEGORIES } = require("../utils/constants");

const createExpenseSchema = Joi.object({
  date: Joi.date().required(),
  category: Joi.string().valid(...EXPENSE_CATEGORIES).required(),
  description: Joi.string().trim().min(2).max(500).required(),
  amount: Joi.number().min(1).required(),
});

module.exports = { createExpenseSchema };
