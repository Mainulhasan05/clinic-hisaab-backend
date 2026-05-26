const LabTest = require("../models/LabTest");
const AppError = require("../utils/AppError");
const { logActivity } = require("./activityService");

const getAllTests = async ({ search = "" }) => {
  const filter = { isActive: true };
  if (search) {
    filter.name = { $regex: search, $options: "i" };
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

module.exports = { getAllTests, createTest, updateTest, deleteTest };
