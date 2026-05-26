const expenseService = require("../services/expenseService");
const sendResponse = require("../utils/sendResponse");

const getAllExpenses = async (req, res, next) => {
  try {
    const result = await expenseService.getAllExpenses(req.query);
    sendResponse(res, 200, "Expenses fetched.", result);
  } catch (error) { next(error); }
};

const getExpenseSummary = async (req, res, next) => {
  try {
    const result = await expenseService.getExpenseSummary();
    sendResponse(res, 200, "Expense summary fetched.", result);
  } catch (error) { next(error); }
};

const createExpense = async (req, res, next) => {
  try {
    const expense = await expenseService.createExpense(req.body, req.user);
    sendResponse(res, 201, "Expense created.", expense);
  } catch (error) { next(error); }
};

const deleteExpense = async (req, res, next) => {
  try {
    await expenseService.deleteExpense(req.params.id, req.user);
    sendResponse(res, 200, "Expense deleted.");
  } catch (error) { next(error); }
};

module.exports = { getAllExpenses, getExpenseSummary, createExpense, deleteExpense };
