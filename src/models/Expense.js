/**
 * Expense model — tracks operational expenses.
 *
 * Categories: rent, utilities, medical_supplies, staff_salaries,
 *             equipment, food, miscellaneous.
 *
 * Only owners and managers can create/view/delete expenses.
 */
const mongoose = require("mongoose");
const { EXPENSE_CATEGORIES } = require("../utils/constants");

const expenseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, "Expense date is required"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: EXPENSE_CATEGORIES,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [1, "Amount must be greater than 0"],
    },
    addedBy: {
      type: String,
      required: true,
      trim: true,
    },
    addedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    staffName: {
      type: String,
      default: null,
    },
    salaryMonth: {
      type: String,
      default: null, // YYYY-MM
    },
  },
  {
    timestamps: true,
  }
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ staffId: 1, salaryMonth: 1 });

module.exports = mongoose.model("Expense", expenseSchema);
