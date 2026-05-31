const User = require("../models/User");
const Expense = require("../models/Expense");
const AppError = require("../utils/AppError");
const escapeRegex = require("../utils/escapeRegex");
const { logActivity } = require("./activityService");

const serializeStaff = (staffDoc) => {
  const staff = typeof staffDoc.toObject === "function" ? staffDoc.toObject() : { ...staffDoc };
  staff.hasPassword = Boolean(staff.password);
  delete staff.password;
  return staff;
};

const getAllStaff = async ({ search = "" }) => {
  const filter = {};
  if (search) {
    const escapedSearch = escapeRegex(search);
    filter.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      { phone: { $regex: escapedSearch, $options: "i" } },
    ];

  }
  const staff = await User.find(filter).select("+password").sort({ createdAt: -1 });
  return staff.map(serializeStaff);
};

const createStaff = async (body, user) => {
  // Salary-only staff: strip password so they cannot log in
  if (body.softwareAccess === false) {
    delete body.password;
  }

  const newStaff = await User.create(body);

  await logActivity({
    type: "staff",
    description: `New staff member added: ${newStaff.name} (${newStaff.role})`,
    operator: user.name,
    operatorId: user._id,
    refId: newStaff._id,
    refModel: "User",
  });

  // Return without password
  return serializeStaff(newStaff);
};

const updateStaff = async (id, body, user) => {
  // Don't allow changing your own role (security)
  if (id === user._id.toString() && body.role) {
    throw new AppError("You cannot change your own role.", 400);
  }

  const staffDoc = await User.findById(id).select("+password");
  if (!staffDoc) throw new AppError("Staff member not found.", 404);

  if (!body.password) {
    delete body.password;
  }

  if (body.softwareAccess === true && !staffDoc.password && !body.password) {
    throw new AppError("Please set a password before enabling software access for this staff member.", 400);
  }

  // If toggling software access OFF, keep the password hash so access can be restored later.
  if (body.softwareAccess === false) {
    delete body.password;
  }

  // Update fields on the document
  Object.assign(staffDoc, body);
  await staffDoc.save(); // Triggers pre-save password hash if password was modified

  return serializeStaff(staffDoc);
};

const deleteStaff = async (id, user) => {
  if (id === user._id.toString()) {
    throw new AppError("You cannot delete your own account.", 400);
  }

  const staff = await User.findById(id);
  if (!staff) throw new AppError("Staff member not found.", 404);

  await User.findByIdAndDelete(id);

  await logActivity({
    type: "staff",
    description: `Staff member removed: ${staff.name} (${staff.role})`,
    operator: user.name,
    operatorId: user._id,
  });
};

const paySalary = async (staffId, { month, amount }, user) => {
  const staff = await User.findById(staffId);
  if (!staff) throw new AppError("Staff member not found.", 404);

  // Validate amount
  if (!amount || amount <= 0) {
    throw new AppError("Amount must be greater than 0.", 400);
  }

  // Validate month format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new AppError("Month must be in YYYY-MM format.", 400);
  }

  // Check for duplicate payment for that month
  const existingPayment = await Expense.findOne({
    staffId,
    category: "staff_salaries",
    salaryMonth: month,
  });
  if (existingPayment) {
    throw new AppError(`Salary for ${month} has already been paid to ${staff.name}.`, 400);
  }

  // Create Expense record
  const expense = await Expense.create({
    date: new Date(),
    category: "staff_salaries",
    description: `Salary payment for ${month} to ${staff.name}`,
    amount,
    addedBy: user.name,
    addedByUserId: user._id,
    staffId: staff._id,
    staffName: staff.name,
    salaryMonth: month,
  });

  // Log activity
  await logActivity({
    type: "staff",
    description: `Salary of ৳${amount} paid to ${staff.name} for ${month}`,
    operator: user.name,
    operatorId: user._id,
    refId: staff._id,
    refModel: "User",
  });

  return expense;
};

const getSalaryHistory = async (staffId) => {
  const staff = await User.findById(staffId);
  if (!staff) throw new AppError("Staff member not found.", 404);
  return Expense.find({ staffId, category: "staff_salaries" }).sort({ salaryMonth: -1 }).lean();
};

const getSalaryReport = async ({ month }) => {
  if (!/^\d{4}-\d{2}$/.test(month || "")) {
    throw new AppError("Month must be in YYYY-MM format.", 400);
  }

  const [staffList, salaryExpenses] = await Promise.all([
    User.find({}).select("-password").sort({ createdAt: -1 }).lean(),
    Expense.find({ category: "staff_salaries", salaryMonth: month }).lean(),
  ]);

  const paymentMap = new Map(salaryExpenses.map((expense) => [String(expense.staffId), expense]));
  const staff = staffList.map((member) => {
    const payment = paymentMap.get(String(member._id));
    return {
      _id: member._id,
      name: member.name,
      phone: member.phone,
      role: member.role,
      expectedSalary: member.salary || 0,
      paidAmount: payment ? payment.amount : 0,
      isPaid: !!payment,
      paidDate: payment ? payment.date : null,
      paidBy: payment ? payment.addedBy : null,
    };
  });

  const totalExpected = staff.reduce((sum, row) => sum + row.expectedSalary, 0);
  const totalPaid = staff.reduce((sum, row) => sum + row.paidAmount, 0);
  const paidCount = staff.filter((row) => row.isPaid).length;

  return {
    month,
    staff,
    totalExpected,
    totalPaid,
    paidCount,
    unpaidCount: staff.length - paidCount,
  };
};

module.exports = {
  getAllStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  paySalary,
  getSalaryHistory,
  getSalaryReport,
};
