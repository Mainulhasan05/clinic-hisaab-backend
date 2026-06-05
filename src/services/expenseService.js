const Expense = require("../models/Expense");
const AppError = require("../utils/AppError");
const escapeRegex = require("../utils/escapeRegex");
const { logActivity } = require("./activityService");

const getAllExpenses = async ({ search = "", category = "all", page = 1, limit = 20, month = "" }) => {
  page = Math.max(parseInt(page, 10) || 1, 1);
  limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = {};
  if (category !== "all") filter.category = category;
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [{ description: regex }, { addedBy: regex }];
  }
  // Month filter: expects "YYYY-MM" format
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mon] = month.split("-").map(Number);
    const startOfMonth = new Date(year, mon - 1, 1);
    const endOfMonth = new Date(year, mon, 1);
    filter.date = { $gte: startOfMonth, $lt: endOfMonth };
  }

  const skip = (page - 1) * limit;
  const [expenses, total, totals] = await Promise.all([
    Expense.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    expenses,
    total,
    totalAmount: totals[0]?.totalAmount || 0,
    page,
    pages: Math.ceil(total / limit),
    limit,
  };
};

const getExpenseSummary = async ({ month = "" } = {}) => {
  let startOfMonth, endOfMonth, monthLabel;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mon] = month.split("-").map(Number);
    startOfMonth = new Date(year, mon - 1, 1);
    endOfMonth = new Date(year, mon, 1);
    monthLabel = month;
  } else {
    const now = new Date();
    startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  const summary = await Expense.aggregate([
    { $match: { date: { $gte: startOfMonth, $lt: endOfMonth } } },
    { $group: { _id: "$category", total: { $sum: "$amount" } } },
  ]);

  const totalExpenses = summary.reduce((sum, cat) => sum + cat.total, 0);
  const byCategory = {};
  summary.forEach((item) => {
    byCategory[item._id] = item.total;
  });

  return { totalExpenses, byCategory, month: monthLabel };
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
