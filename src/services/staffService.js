const User = require("../models/User");
const AppError = require("../utils/AppError");
const { logActivity } = require("./activityService");

const getAllStaff = async ({ search = "" }) => {
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
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

  const staff = await User.findByIdAndUpdate(id, body, { new: true, runValidators: true })
    .select("-password");
  if (!staff) throw new AppError("Staff member not found.", 404);
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

module.exports = { getAllStaff, createStaff, updateStaff, deleteStaff };
