const dashboardService = require("../services/dashboardService");
const sendResponse = require("../utils/sendResponse");

const getDashboardStats = async (req, res, next) => {
  try {
    const result = await dashboardService.getDashboardStats();
    sendResponse(res, 200, "Dashboard stats fetched.", result);
  } catch (error) { next(error); }
};

const getDailySales = async (req, res, next) => {
  try {
    const result = await dashboardService.getDailySales(req.query);
    sendResponse(res, 200, "Daily sales fetched.", result);
  } catch (error) { next(error); }
};

const getAnalytics = async (req, res, next) => {
  try {
    const result = await dashboardService.getAnalytics();
    sendResponse(res, 200, "Analytics fetched.", result);
  } catch (error) { next(error); }
};

const getCollectionReport = async (req, res, next) => {
  try {
    const result = await dashboardService.getCollectionReport(req.query);
    sendResponse(res, 200, "Collection report fetched.", result);
  } catch (error) { next(error); }
};

const getRecentActivity = async (req, res, next) => {
  try {
    const result = await dashboardService.getRecentActivity(req.query);
    sendResponse(res, 200, "Recent activities fetched.", result);
  } catch (error) { next(error); }
};

const getMonthlyFinancials = async (req, res, next) => {
  try {
    const result = await dashboardService.getMonthlyFinancials(req.query.months);
    sendResponse(res, 200, "Monthly financials fetched.", result);
  } catch (error) { next(error); }
};

module.exports = { getDashboardStats, getDailySales, getAnalytics, getCollectionReport, getRecentActivity, getMonthlyFinancials };
