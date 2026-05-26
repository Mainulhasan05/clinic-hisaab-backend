const Patient = require("../models/Patient");
const Invoice = require("../models/Invoice");
const Seat = require("../models/Seat");
const Expense = require("../models/Expense");
const ActivityLog = require("../models/ActivityLog");

/**
 * Helper: Get start of today and start of this month.
 */
const getDateRanges = () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return { now, startOfToday, startOfMonth };
};

const getDashboardStats = async () => {
  const { startOfToday, startOfMonth } = getDateRanges();

  const [
    totalPatients,
    activeInpatients,
    todayInvoices,
    monthlyRevenueResult,
    vacantSeats,
    totalSeats,
    pendingDuesResult,
    monthlyExpensesResult,
    newPatientsThisMonth,
  ] = await Promise.all([
    Patient.countDocuments({}),
    Patient.countDocuments({ type: "inpatient", status: "admitted" }),
    Invoice.find({ createdAt: { $gte: startOfToday } }),
    Invoice.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Seat.countDocuments({ status: "vacant" }),
    Seat.countDocuments({}),
    Invoice.aggregate([
      { $match: { dueAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$dueAmount" } } },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Patient.countDocuments({ createdAt: { $gte: startOfMonth } }),
  ]);

  const todayRevenue = todayInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const todayLabTests = todayInvoices.reduce((sum, inv) => sum + (inv.tests?.length || 0), 0);
  const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;
  const pendingDues = pendingDuesResult[0]?.total || 0;
  const monthlyExpenses = monthlyExpensesResult[0]?.total || 0;

  // Sparkline — last 7 days revenue
  const revenueSparkline = [];
  const patientSparkline = [];
  const testSparkline = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayInvoices = await Invoice.find({
      createdAt: { $gte: dayStart, $lt: dayEnd },
    });
    revenueSparkline.push(dayInvoices.reduce((s, inv) => s + inv.totalAmount, 0));
    patientSparkline.push(dayInvoices.length);
    testSparkline.push(dayInvoices.reduce((s, inv) => s + (inv.tests?.length || 0), 0));
  }

  return {
    totalPatients,
    activeInpatients,
    todayLabTests,
    todayRevenue,
    monthlyRevenue,
    vacantSeats,
    totalSeats,
    pendingDues,
    monthlyExpenses,
    netProfit: monthlyRevenue - monthlyExpenses,
    avgDailyRevenue: Math.round(monthlyRevenue / new Date().getDate()),
    newPatientsThisMonth,
    todayPatientCount: todayInvoices.length,
    revenueSparkline,
    patientSparkline,
    testSparkline,
  };
};

const getDailySales = async ({ days = 30 }) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const result = await Invoice.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        totalSales: { $sum: "$totalAmount" },
        labSales: {
          $sum: { $cond: [{ $eq: ["$receiptType", "lab"] }, "$totalAmount", 0] },
        },
        inpatientSales: {
          $sum: { $cond: [{ $eq: ["$receiptType", "admission"] }, "$totalAmount", 0] },
        },
        patientCount: { $addToSet: "$patientId" },
        labTestCount: { $sum: { $size: { $ifNull: ["$tests", []] } } },
      },
    },
    {
      $project: {
        date: "$_id",
        totalSales: 1,
        labSales: 1,
        inpatientSales: 1,
        patientCount: { $size: "$patientCount" },
        labTestCount: 1,
      },
    },
    { $sort: { date: 1 } },
  ]);

  return result;
};

const getAnalytics = async () => {
  const [topTestsByRevenue, revenueByCategory, patientTypeDistribution] = await Promise.all([
    Invoice.aggregate([
      { $unwind: "$tests" },
      { $group: { _id: "$tests.name", revenue: { $sum: "$tests.price" }, count: { $sum: 1 } } },
      { $project: { name: "$_id", revenue: 1, count: 1, _id: 0 } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Invoice.aggregate([
      {
        $group: {
          _id: "$receiptType",
          value: { $sum: "$totalAmount" },
        },
      },
      { $project: { label: "$_id", value: 1, _id: 0 } },
    ]),
    Patient.aggregate([
      { $group: { _id: "$type", value: { $sum: 1 } } },
      { $project: { label: "$_id", value: 1, _id: 0 } },
    ]),
  ]);

  return { topTestsByRevenue, revenueByCategory, patientTypeDistribution };
};

const getRecentActivity = async ({ limit = 15 }) => {
  return ActivityLog.find({}).sort({ createdAt: -1 }).limit(limit);
};

module.exports = { getDashboardStats, getDailySales, getAnalytics, getRecentActivity };
