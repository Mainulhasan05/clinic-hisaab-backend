const Doctor = require("../models/Doctor");
const Invoice = require("../models/Invoice");
const AppError = require("../utils/AppError");
const escapeRegex = require("../utils/escapeRegex");
const { logActivity } = require("./activityService");

const getAllDoctors = async ({ search = "", showInactive = "false" } = {}) => {
  const filter = {};
  
  if (showInactive !== "true") {
    filter.isActive = true;
  }
  
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [
      { name: regex },
      { designation: regex },
      { degrees: regex },
      { workplace: regex },
    ];
  }

  return Doctor.find(filter).sort({ name: 1 });
};

const createDoctor = async (body, user) => {
  // Check if doctor name already exists
  const existing = await Doctor.findOne({
    name: { $regex: new RegExp(`^${escapeRegex(body.name.trim())}$`, "i") }
  });
  if (existing) {
    throw new AppError("A doctor with this name already exists.", 400);
  }

  const doctor = await Doctor.create(body);

  await logActivity({
    type: "doctor",
    description: `New reference doctor added: ${doctor.name} (${doctor.designation || "No Designation"})`,
    operator: user.name,
    operatorId: user._id,
    refId: doctor._id,
    refModel: "Doctor",
  });

  return doctor;
};

const updateDoctor = async (id, body, user) => {
  if (body.name) {
    const existing = await Doctor.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${escapeRegex(body.name.trim())}$`, "i") }
    });
    if (existing) {
      throw new AppError("Another doctor with this name already exists.", 400);
    }
  }

  const doctor = await Doctor.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!doctor) {
    throw new AppError("Doctor not found.", 404);
  }

  await logActivity({
    type: "doctor",
    description: `Reference doctor updated: ${doctor.name}`,
    operator: user.name,
    operatorId: user._id,
    refId: doctor._id,
    refModel: "Doctor",
  });

  return doctor;
};

const deleteDoctor = async (id, user) => {
  // Soft delete to maintain consistency of historical reports referencing doctor by name
  const doctor = await Doctor.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!doctor) {
    throw new AppError("Doctor not found.", 404);
  }

  await logActivity({
    type: "doctor",
    description: `Reference doctor deactivated (soft deleted): ${doctor.name}`,
    operator: user.name,
    operatorId: user._id,
    refId: doctor._id,
    refModel: "Doctor",
  });

  return doctor;
};

const getDoctorReport = async ({ search = "", startDate = "", endDate = "" } = {}) => {
  const match = { 
    status: { $ne: "cancelled" }, 
    doctorName: { $exists: true, $ne: "" } 
  };

  // Date filters
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) {
      match.createdAt.$gte = new Date(`${startDate}T00:00:00`);
    }
    if (endDate) {
      const end = new Date(`${endDate}T23:59:59.999`);
      match.createdAt.$lte = end;
    }
  }

  // Optional search filter by doctor name
  if (search) {
    match.doctorName = { $regex: escapeRegex(search), $options: "i" };
  }

  // 1. Aggregate grouping by doctor and date (local Asia/Dhaka timezone)
  const report = await Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          doctorName: "$doctorName",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Dhaka" } }
        },
        receiptCount: { $sum: 1 },
        totalAmount: { $sum: "$totalAmount" }
      }
    },
    {
      $group: {
        _id: "$_id.doctorName",
        totalReceipts: { $sum: "$receiptCount" },
        totalAmount: { $sum: "$totalAmount" },
        dates: {
          $push: {
            date: "$_id.date",
            receiptCount: "$receiptCount",
            totalAmount: "$totalAmount"
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        doctorName: "$_id",
        totalReceipts: 1,
        totalAmount: 1,
        dates: 1
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);

  // Sort each doctor's date records in reverse chronological order (newest date first)
  report.forEach((item) => {
    if (item.dates && Array.isArray(item.dates)) {
      item.dates.sort((a, b) => b.date.localeCompare(a.date));
    }
  });

  return report;
};

module.exports = {
  getAllDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorReport,
};
