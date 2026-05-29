const Patient = require("../models/Patient");
const Invoice = require("../models/Invoice");
const Seat = require("../models/Seat");
const Expense = require("../models/Expense");
const ActivityLog = require("../models/ActivityLog");
const escapeRegex = require("../utils/escapeRegex");

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const dayRange = (dateString) => {
  const base = dateString ? new Date(`${dateString}T00:00:00`) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
  return { start, end };
};

const monthRange = (monthString) => {
  const [year, month] = String(monthString || "").split("-").map(Number);
  const now = new Date();
  const safeYear = Number.isFinite(year) ? year : now.getFullYear();
  const safeMonth = Number.isFinite(month) ? month - 1 : now.getMonth();
  return {
    start: new Date(safeYear, safeMonth, 1),
    end: new Date(safeYear, safeMonth + 1, 1),
  };
};

const getDateRanges = () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return { now, startOfToday, startOfTomorrow, startOfMonth };
};

const splitPaidStages = [
  {
    $addFields: {
      testsTotal: {
        $sum: {
          $map: {
            input: { $ifNull: ["$tests", []] },
            as: "test",
            in: { $ifNull: ["$$test.price", 0] },
          },
        },
      },
      admissionTotal: {
        $add: [
          { $ifNull: ["$seatCharge.total", 0] },
          { $ifNull: ["$admissionCharges.surgeonCharge", 0] },
          { $ifNull: ["$admissionCharges.anesthesiaCharge", 0] },
          { $ifNull: ["$admissionCharges.otCharge", 0] },
          { $ifNull: ["$admissionCharges.assistantCharge", 0] },
          { $ifNull: ["$admissionCharges.medicineCost", 0] },
          { $ifNull: ["$admissionCharges.serviceCharge", 0] },
          { $ifNull: ["$admissionCharges.vat", 0] },
          { $ifNull: ["$admissionCharges.otherCharges", 0] },
        ],
      },
      isAdmissionReceipt: {
        $or: [
          { $eq: ["$receiptType", "admission"] },
          { $eq: ["$patientType", "inpatient"] },
        ],
      },
    },
  },
  {
    $addFields: {
      rawSplitTotal: { $add: ["$testsTotal", "$admissionTotal"] },
    },
  },
  {
    $addFields: {
      labPaid: {
        $cond: [
          { $lte: [{ $ifNull: ["$paidAmount", 0] }, 0] },
          0,
          {
            $cond: [
              { $eq: ["$rawSplitTotal", 0] },
              {
                $cond: [
                  "$isAdmissionReceipt",
                  0,
                  { $ifNull: ["$paidAmount", 0] },
                ],
              },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$testsTotal", "$rawSplitTotal"] },
                      { $ifNull: ["$paidAmount", 0] },
                    ],
                  },
                  0,
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    $addFields: {
      admissionPaid: {
        $subtract: [{ $ifNull: ["$paidAmount", 0] }, "$labPaid"],
      },
    },
  },
];

const buildCollectionMatch = ({
  filterMode = "month",
  selectedDate,
  selectedMonth,
  startDate,
  endDate,
  reportType = "all",
  query = "",
} = {}) => {
  const match = { status: { $ne: "cancelled" } };

  if (filterMode === "date") {
    const range = dayRange(selectedDate);
    match.createdAt = { $gte: range.start, $lt: range.end };
  } else if (filterMode === "range") {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T00:00:00`) : null;
    if (end) end.setDate(end.getDate() + 1);
    if (start || end) {
      match.createdAt = {};
      if (start) match.createdAt.$gte = start;
      if (end) match.createdAt.$lt = end;
    }
  } else {
    const range = monthRange(selectedMonth);
    match.createdAt = { $gte: range.start, $lt: range.end };
  }

  if (reportType === "lab") {
    match.receiptType = { $ne: "admission" };
  } else if (reportType === "admission") {
    match.$or = [{ receiptType: "admission" }, { patientType: "inpatient" }];
  } else if (reportType === "due") {
    match.dueAmount = { $gt: 0 };
  } else if (reportType === "discount") {
    match.discountAmount = { $gt: 0 };
  }

  if (query && query.trim()) {
    const regex = { $regex: escapeRegex(query.trim()), $options: "i" };
    const searchOr = [
      { invoiceId: regex },
      { patientName: regex },
      { patientPhone: regex },
      { patientSerial: regex },
      { operatorName: regex },
      { paymentMethod: regex },
    ];
    if (match.$or) {
      match.$and = [{ $or: match.$or }, { $or: searchOr }];
      delete match.$or;
    } else {
      match.$or = searchOr;
    }
  }

  return match;
};

const getDashboardStats = async () => {
  const { startOfToday, startOfTomorrow, startOfMonth } = getDateRanges();

  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [
    totalPatients,
    activeInpatients,
    todayInvoiceSummary,
    monthlyRevenueResult,
    vacantSeats,
    totalSeats,
    pendingDuesResult,
    totalDiscountResult,
    monthlyExpensesResult,
    newPatientsThisMonth,
    lastSevenDaysSummary,
  ] = await Promise.all([
    Patient.countDocuments({}),
    Patient.countDocuments({ type: "inpatient", status: "admitted" }),
    Invoice.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: startOfToday, $lt: startOfTomorrow } } },
      ...splitPaidStages,
      {
        $group: {
          _id: null,
          todayRevenue: { $sum: "$totalAmount" },
          todayLabCollection: { $sum: "$labPaid" },
          todayAdmissionCollection: { $sum: "$admissionPaid" },
          todayPatientCount: { $sum: 1 },
          todayLabTests: { $sum: { $size: { $ifNull: ["$tests", []] } } },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Seat.countDocuments({ status: "vacant" }),
    Seat.countDocuments({}),
    Invoice.aggregate([
      { $match: { status: { $ne: "cancelled" }, dueAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$dueAmount" } } },
    ]),
    Invoice.aggregate([
      { $match: { status: { $ne: "cancelled" }, discountAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$discountAmount" } } },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Patient.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Invoice.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$totalAmount" },
          patients: { $sum: 1 },
          tests: { $sum: { $size: { $ifNull: ["$tests", []] } } },
        },
      },
    ]),
  ]);

  const dateKeys = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - i);
    dateKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  const sparklineMap = new Map(lastSevenDaysSummary.map((row) => [row._id, row]));
  const revenueSparkline = dateKeys.map((key) => sparklineMap.get(key)?.revenue || 0);
  const patientSparkline = dateKeys.map((key) => sparklineMap.get(key)?.patients || 0);
  const testSparkline = dateKeys.map((key) => sparklineMap.get(key)?.tests || 0);

  const today = todayInvoiceSummary[0] || {};
  const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;
  const monthlyExpenses = monthlyExpensesResult[0]?.total || 0;

  return {
    totalPatients,
    activeInpatients,
    todayLabTests: today.todayLabTests || 0,
    todayRevenue: today.todayRevenue || 0,
    monthlyRevenue,
    vacantSeats,
    totalSeats,
    pendingDues: pendingDuesResult[0]?.total || 0,
    totalDiscount: totalDiscountResult[0]?.total || 0,
    todayLabCollection: today.todayLabCollection || 0,
    todayAdmissionCollection: today.todayAdmissionCollection || 0,
    monthlyExpenses,
    netProfit: monthlyRevenue - monthlyExpenses,
    avgDailyRevenue: Math.round(monthlyRevenue / new Date().getDate()),
    newPatientsThisMonth,
    todayPatientCount: today.todayPatientCount || 0,
    revenueSparkline,
    patientSparkline,
    testSparkline,
  };
};

const getDailySales = async ({ days = 30 }) => {
  const parsedDays = parsePositiveInt(days, 30, 370);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parsedDays);
  startDate.setHours(0, 0, 0, 0);

  return Invoice.aggregate([
    { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: startDate } } },
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
        newAdmissions: {
          $sum: {
            $cond: [
              { $or: [{ $eq: ["$receiptType", "admission"] }, { $eq: ["$patientType", "inpatient"] }] },
              1,
              0,
            ],
          },
        },
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
        newAdmissions: 1,
        _id: 0,
      },
    },
    { $sort: { date: 1 } },
  ]);
};

const getAnalytics = async () => {
  const [topTestsByRevenue, revenueByCategory, patientTypeDistribution] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $unwind: "$tests" },
      { $group: { _id: "$tests.name", revenue: { $sum: "$tests.price" }, count: { $sum: 1 } } },
      { $project: { name: "$_id", revenue: 1, count: 1, _id: 0 } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Invoice.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: "$receiptType", value: { $sum: "$totalAmount" } } },
      { $project: { label: "$_id", value: 1, _id: 0 } },
    ]),
    Patient.aggregate([
      { $group: { _id: "$type", value: { $sum: 1 } } },
      { $project: { label: "$_id", value: 1, _id: 0 } },
    ]),
  ]);

  return { topTestsByRevenue, revenueByCategory, patientTypeDistribution };
};

const getCollectionReport = async (query = {}) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 25, 100);
  const skip = (page - 1) * limit;
  const match = buildCollectionMatch(query);

  const [summaryRows, dailyRows, receipts, total] = await Promise.all([
    Invoice.aggregate([
      { $match: match },
      ...splitPaidStages,
      {
        $group: {
          _id: null,
          receipts: { $sum: 1 },
          totalCollection: { $sum: { $ifNull: ["$paidAmount", 0] } },
          labCollection: { $sum: "$labPaid" },
          admissionCollection: { $sum: "$admissionPaid" },
          totalDue: { $sum: { $ifNull: ["$dueAmount", 0] } },
          totalDiscount: { $sum: { $ifNull: ["$discountAmount", 0] } },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: match },
      ...splitPaidStages,
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          receipts: { $sum: 1 },
          labCollection: { $sum: "$labPaid" },
          admissionCollection: { $sum: "$admissionPaid" },
          totalCollection: { $sum: { $ifNull: ["$paidAmount", 0] } },
          discount: { $sum: { $ifNull: ["$discountAmount", 0] } },
          due: { $sum: { $ifNull: ["$dueAmount", 0] } },
        },
      },
      { $project: { _id: 0, date: "$_id", receipts: 1, labCollection: 1, admissionCollection: 1, totalCollection: 1, discount: 1, due: 1 } },
      { $sort: { date: -1 } },
    ]),
    Invoice.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("invoiceId receiptType patientType patientName patientPhone patientSerial operatorName totalAmount paidAmount dueAmount discountAmount paymentMethod createdAt")
      .lean(),
    Invoice.countDocuments(match),
  ]);

  return {
    summary: summaryRows[0] || {
      receipts: 0,
      totalCollection: 0,
      labCollection: 0,
      admissionCollection: 0,
      totalDue: 0,
      totalDiscount: 0,
    },
    dailyRows,
    receipts,
    total,
    page,
    pages: Math.ceil(total / limit),
    limit,
  };
};

const getRecentActivity = async ({ limit = 15 }) => {
  const parsedLimit = parsePositiveInt(limit, 15, 50);
  return ActivityLog.find({}).sort({ createdAt: -1 }).limit(parsedLimit).lean();
};

const getMonthlyFinancials = async (months = 12) => {
  const parsedMonths = parsePositiveInt(months, 12, 60);

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - (parsedMonths - 1));
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const [incomeResults, expenseResults] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: startDate } } },
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

  const monthKeys = [];
  const now = new Date();
  for (let i = parsedMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const incomeMap = {};
  incomeResults.forEach((item) => {
    incomeMap[item._id] = item.totalIncome;
  });

  const expenseMap = {};
  expenseResults.forEach((item) => {
    const month = item._id.month;
    const category = item._id.category;
    if (!expenseMap[month]) {
      expenseMap[month] = { total: 0, breakdown: {} };
    }
    expenseMap[month].total += item.totalAmount;
    expenseMap[month].breakdown[category] = item.totalAmount;
  });

  const monthlyFinancials = monthKeys.map((month) => {
    const income = incomeMap[month] || 0;
    const expData = expenseMap[month] || { total: 0, breakdown: {} };
    return {
      month,
      income,
      expenses: expData.total,
      profit: income - expData.total,
      expenseBreakdown: expData.breakdown,
    };
  });

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
  const categoryRankings = Object.entries(categoryTotals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    monthlyFinancials,
    summary: {
      totalIncome,
      totalExpenses,
      totalProfit,
      averageMonthlyProfit: monthlyFinancials.length > 0 ? Math.round(totalProfit / monthlyFinancials.length) : 0,
      salaryExpense: categoryTotals.staff_salaries || 0,
      salaryPercentageOfExpenses: totalExpenses > 0 ? Math.round(((categoryTotals.staff_salaries || 0) / totalExpenses) * 100) : 0,
      categoryRankings,
    },
  };
};

module.exports = {
  getDashboardStats,
  getDailySales,
  getAnalytics,
  getCollectionReport,
  getRecentActivity,
  getMonthlyFinancials,
};
