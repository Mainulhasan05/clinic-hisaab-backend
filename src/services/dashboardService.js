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

  // Sparkline — query last 7 days invoices in a single query
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const lastSevenDaysInvoices = await Invoice.find({
    createdAt: { $gte: sevenDaysAgo },
  });

  const revenueSparkline = Array(7).fill(0);
  const patientSparkline = Array(7).fill(0);
  const testSparkline = Array(7).fill(0);

  // Generate date string keys for the last 7 days (YYYY-MM-DD)
  const dateKeys = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dateKeys.push(key);
  }

  lastSevenDaysInvoices.forEach((inv) => {
    const d = new Date(inv.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const index = dateKeys.indexOf(key);
    if (index !== -1) {
      revenueSparkline[index] += inv.totalAmount;
      patientSparkline[index] += 1;
      testSparkline[index] += inv.tests?.length || 0;
    }
  });

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
  const parsedDays = parseInt(days, 10) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parsedDays);
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
  const parsedLimit = parseInt(limit, 10) || 15;
  return ActivityLog.find({}).sort({ createdAt: -1 }).limit(parsedLimit);
};

const getMonthlyFinancials = async (months = 12) => {
  const parsedMonths = parseInt(months, 10) || 12;

  // Calculate start date
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - (parsedMonths - 1));
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  // Parallel database aggregation
  const [incomeResults, expenseResults] = await Promise.all([
    Invoice.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          totalIncome: { $sum: "$totalAmount" },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$date" } },
            category: "$category",
          },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  // Generate continuous list of months
  const monthKeys = [];
  const now = new Date();
  for (let i = parsedMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    monthKeys.push(`${year}-${month}`);
  }

  // Maps for quick lookup
  const incomeMap = {};
  incomeResults.forEach((item) => {
    incomeMap[item._id] = item.totalIncome;
  });

  const expenseMap = {};
  expenseResults.forEach((item) => {
    const month = item._id.month;
    const category = item._id.category;
    const amount = item.totalAmount;

    if (!expenseMap[month]) {
      expenseMap[month] = { total: 0, breakdown: {} };
    }
    expenseMap[month].total += amount;
    expenseMap[month].breakdown[category] = amount;
  });

  // Assemble chronological array
  const monthlyFinancials = monthKeys.map((month) => {
    const income = incomeMap[month] || 0;
    const expData = expenseMap[month] || { total: 0, breakdown: {} };
    const expenses = expData.total;
    const profit = income - expenses;
    const expenseBreakdown = expData.breakdown;

    return {
      month,
      income,
      expenses,
      profit,
      expenseBreakdown,
    };
  });

  // Calculate totals and metrics
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals = {};

  monthlyFinancials.forEach((m) => {
    totalIncome += m.income;
    totalExpenses += m.expenses;
    Object.entries(m.expenseBreakdown).forEach(([cat, amt]) => {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });
  });

  const totalProfit = totalIncome - totalExpenses;
  const averageMonthlyProfit =
    monthlyFinancials.length > 0 ? Math.round(totalProfit / monthlyFinancials.length) : 0;

  const salaryExpense = categoryTotals["staff_salaries"] || 0;
  const salaryPercentageOfExpenses =
    totalExpenses > 0 ? Math.round((salaryExpense / totalExpenses) * 100) : 0;

  const categoryRankings = Object.entries(categoryTotals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    monthlyFinancials,
    summary: {
      totalIncome,
      totalExpenses,
      totalProfit,
      averageMonthlyProfit,
      salaryExpense,
      salaryPercentageOfExpenses,
      categoryRankings,
    },
  };
};

module.exports = {
  getDashboardStats,
  getDailySales,
  getAnalytics,
  getRecentActivity,
  getMonthlyFinancials,
};
