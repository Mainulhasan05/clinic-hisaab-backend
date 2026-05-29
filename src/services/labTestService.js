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

module.exports = { getAllTests, createTest, updateTest, deleteTest, getTestCustomerGroups };
