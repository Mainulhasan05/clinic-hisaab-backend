const LabTest = require("../models/LabTest");
const Invoice = require("../models/Invoice");
const AppError = require("../utils/AppError");
const escapeRegex = require("../utils/escapeRegex");
const { logActivity } = require("./activityService");

const getAllTests = async ({ search = "" }) => {
  const filter = { isActive: true };
  if (search) {
    filter.name = { $regex: escapeRegex(search), $options: "i" };
  }
  return LabTest.find(filter).sort({ name: 1 });
};

const createTest = async (body, user) => {
  const test = await LabTest.create(body);
  await logActivity({
    type: "test",
    description: `New lab test added: ${test.name} (৳${test.price})`,
    operator: user.name,
    operatorId: user._id,
    refId: test._id,
    refModel: "LabTest",
  });
  return test;
};

const updateTest = async (id, body, user) => {
  const test = await LabTest.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!test) throw new AppError("Lab test not found.", 404);
  return test;
};

const deleteTest = async (id, user) => {
  // Soft delete — set isActive to false instead of removing
  const test = await LabTest.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!test) throw new AppError("Lab test not found.", 404);
  await logActivity({
    type: "test",
    description: `Lab test deleted: ${test.name}`,
    operator: user.name,
    operatorId: user._id,
    refId: test._id,
    refModel: "LabTest",
  });
};

/** @deprecated Use getTestCustomerRecords instead — this loads all invoices without pagination. */
const getTestCustomerGroups = async ({ search = "", customerLimit = 20 } = {}) => {
  customerLimit = Math.min(Math.max(parseInt(customerLimit, 10) || 20, 1), 50);
  const tests = await LabTest.find({ isActive: true }).sort({ name: 1 }).lean();
  const invoiceMatch = { status: { $ne: "cancelled" } };

  if (search && search.trim()) {
    const regex = { $regex: escapeRegex(search.trim()), $options: "i" };
    invoiceMatch.$or = [
      { "tests.name": regex },
      { patientName: regex },
      { patientPhone: regex },
      { invoiceId: regex },
    ];
  }

  const stats = await Invoice.aggregate([
    { $unwind: "$tests" },
    Object.keys(invoiceMatch).length ? { $match: invoiceMatch } : { $match: {} },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { $toLower: "$tests.name" },
        name: { $first: "$tests.name" },
        customerCount: { $sum: 1 },
        totalPaid: { $sum: "$paidAmount" },
        totalDue: { $sum: "$dueAmount" },
        customers: {
          $push: {
            _id: "$_id",
            invoiceId: "$invoiceId",
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            patientName: "$patientName",
            patientPhone: "$patientPhone",
            patientSerial: "$patientSerial",
            paidAmount: "$paidAmount",
            dueAmount: "$dueAmount",
            operatorName: "$operatorName",
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        key: "$_id",
        name: 1,
        customerCount: 1,
        totalPaid: 1,
        totalDue: 1,
        customers: { $slice: ["$customers", customerLimit] },
      },
    },
  ]);

  const statMap = new Map(stats.map((item) => [item.key, item]));
  const q = search.trim().toLowerCase();

  return tests
    .map((test) => {
      const key = String(test.name || "").toLowerCase();
      const stat = statMap.get(key) || {};
      return {
        ...test,
        customerCount: stat.customerCount || 0,
        totalPaid: stat.totalPaid || 0,
        totalDue: stat.totalDue || 0,
        customers: stat.customers || [],
      };
    })
    .filter((test) => {
      if (!q) return true;
      return (
        test.name?.toLowerCase().includes(q) ||
        test.category?.toLowerCase().includes(q) ||
        test.customerCount > 0
      );
    });
};

/**
 * Paginated customer records for lab test directory.
 * Runs two parallel queries:
 *   1. find() with skip/limit for page records
 *   2. aggregate() for lightweight summary stats
 * Stats object is filter-aware (reflects current search/filter state).
 */
const getTestCustomerRecords = async ({
  search = "",
  testName = "all",
  filterStatus = "all",
  dateRange = "all",
  page = 1,
  limit = 20,
} = {}) => {
  page = Math.max(parseInt(page, 10) || 1, 1);
  limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const filter = { status: { $ne: "cancelled" } };

  // Filter by specific lab test name
  if (testName && testName !== "all") {
    filter["tests.name"] = testName;
  }

  // Filter by payment status (overrides the $ne cancelled base)
  if (filterStatus && filterStatus !== "all") {
    filter.status = filterStatus;
  }

  // Search across patient name, phone, invoice ID, and test names
  if (search && search.trim()) {
    const escapedSearch = escapeRegex(search.trim());
    const regex = { $regex: escapedSearch, $options: "i" };
    filter.$or = [
      { patientName: regex },
      { patientPhone: regex },
      { invoiceId: regex },
      { "tests.name": regex },
    ];
  }

  // Date range filtering
  if (dateRange && dateRange !== "all") {
    const now = new Date();
    let startDate, endDate;

    switch (dateRange) {
      case "today": {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      }
      case "yesterday": {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case "last7": {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      }
      case "last30": {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      }
      case "thisMonth": {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      }
      default:
        break;
    }

    if (startDate && endDate) {
      filter.createdAt = { $gte: startDate, $lt: endDate };
    }
  }

  const skip = (page - 1) * limit;

  // Select only the fields the frontend needs — keeps response lean
  const projection = {
    invoiceId: 1,
    createdAt: 1,
    patientId: 1,
    patientSerial: 1,
    patientName: 1,
    patientPhone: 1,
    patientAge: 1,
    patientGender: 1,
    tests: 1,
    totalAmount: 1,
    paidAmount: 1,
    dueAmount: 1,
    status: 1,
    operatorName: 1,
    receiptType: 1,
  };

  // Run page query and stats aggregation in parallel
  const [customers, total, statsResult] = await Promise.all([
    Invoice.find(filter, projection).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Invoice.countDocuments(filter),
    Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalCollected: { $sum: "$paidAmount" },
          totalDue: { $sum: "$dueAmount" },
          paidCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
          partialCount: { $sum: { $cond: [{ $eq: ["$status", "partial"] }, 1, 0] } },
          unpaidCount: { $sum: { $cond: [{ $eq: ["$status", "unpaid"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const stats = statsResult[0] || {
    totalRevenue: 0,
    totalCollected: 0,
    totalDue: 0,
    paidCount: 0,
    partialCount: 0,
    unpaidCount: 0,
  };
  delete stats._id;

  return {
    customers,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
    stats,
  };
};

module.exports = { getAllTests, createTest, updateTest, deleteTest, getTestCustomerGroups, getTestCustomerRecords };
