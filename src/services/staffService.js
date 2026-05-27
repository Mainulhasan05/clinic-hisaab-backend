const User = require("../models/User");
const Expense = require("../models/Expense");
const AppError = require("../utils/AppError");
const escapeRegex = require("../utils/escapeRegex");
const { logActivity } = require("./activityService");

const getAllStaff = async ({ search = "" }) => {
  const filter = {};
  if (search) {
    const escapedSearch = escapeRegex(search);
    filter.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      { phone: { $regex: escapedSearch, $options: "i" } },
    ];

  }
  return User.find(filter).select("-password").sort({ createdAt: -1 });
};

const createStaff = async (body, user) => {
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
  const staff = newStaff.toObject();
  delete staff.password;
  return staff;
};

const updateStaff = async (id, body, user) => {
  // Don't allow changing your own role (security)
  if (id === user._id.toString() && body.role) {
    throw new AppError("You cannot change your own role.", 400);
  }

  const staffDoc = await User.findById(id);
  if (!staffDoc) throw new AppError("Staff member not found.", 404);

  // Update fields on the document
  Object.assign(staffDoc, body);
  await staffDoc.save(); // Triggers pre-save password hash if password was modified

  const staff = staffDoc.toObject();
  delete staff.password;
  return staff;
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
  return Expense.find({ staffId, category: "staff_salaries" }).sort({ salaryMonth: -1 });
};

module.exports = {
  getAllStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  paySalary,
  getSalaryHistory,
};
