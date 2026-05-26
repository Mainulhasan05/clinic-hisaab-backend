const Expense = require("../models/Expense");
const AppError = require("../utils/AppError");
const { logActivity } = require("./activityService");

const getAllExpenses = async ({ search = "", category = "all", page = 1, limit = 50 }) => {
  const filter = {};
  if (category !== "all") filter.category = category;
  if (search) {
    filter.description = { $regex: search, $options: "i" };
  }

  const skip = (page - 1) * limit;
  const [expenses, total] = await Promise.all([
    Expense.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    Expense.countDocuments(filter),
  ]);

  return { expenses, total, page: Number(page), pages: Math.ceil(total / limit) };
};

const getExpenseSummary = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const summary = await Expense.aggregate([
    { $match: { date: { $gte: startOfMonth } } },
    { $group: { _id: "$category", total: { $sum: "$amount" } } },
  ]);

  const totalExpenses = summary.reduce((sum, cat) => sum + cat.total, 0);
  const byCategory = {};
  summary.forEach((item) => {
    byCategory[item._id] = item.total;
  });

  return { totalExpenses, byCategory };
};

const createExpense = async (body, user) => {
  const expense = await Expense.create({
    ...body,
    addedBy: user.name,
    addedByUserId: user._id,
  });

  await logActivity({
    type: "expense",
    description: `Expense recorded: ${body.description} — ৳${body.amount}`,
    operator: user.name,
    operatorId: user._id,
    refId: expense._id,
    refModel: "Expense",
  });

  return expense;
};

const deleteExpense = async (id, user) => {
  const expense = await Expense.findById(id);
  if (!expense) throw new AppError("Expense not found.", 404);

  await Expense.findByIdAndDelete(id);

  await logActivity({
    type: "expense",
    description: `Expense deleted: ${expense.description} (৳${expense.amount})`,
    operator: user.name,
    operatorId: user._id,
  });
};

module.exports = { getAllExpenses, getExpenseSummary, createExpense, deleteExpense };
