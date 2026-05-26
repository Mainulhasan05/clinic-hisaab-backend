const Patient = require("../models/Patient");
const Seat = require("../models/Seat");
const AppError = require("../utils/AppError");
const generatePatientId = require("../utils/generatePatientId");
const escapeRegex = require("../utils/escapeRegex");
const { logActivity } = require("./activityService");
const { sendSingleSms } = require("./smsService");


const getAllPatients = async ({ search = "", filterType = "all", page = 1, limit = 20 }) => {
  const filter = {};

  // Apply type filter
  if (filterType !== "all") {
    filter.type = filterType;
  }

  // Apply search (searches name, phone, and patientId)
  if (search) {
    const escapedSearch = escapeRegex(search);
    filter.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      { phone: { $regex: escapedSearch, $options: "i" } },
      { patientId: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [patients, total] = await Promise.all([
    Patient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Patient.countDocuments(filter),
  ]);

  return {
    patients,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

const getPatientById = async (id) => {
  const patient = await Patient.findById(id);
  if (!patient) throw new AppError("Patient not found.", 404);
  return patient;
};

const createPatient = async (body, user) => {
  // Auto-generate the patient ID
  const patientId = await generatePatientId();

  const patientData = {
    ...body,
    patientId,
    createdBy: user._id,
  };

  // If inpatient with a seat, set status to "admitted" and occupy the seat
  if (body.type === "inpatient" && body.seatId) {
    const seat = await Seat.findById(body.seatId);
    if (!seat) throw new AppError("Selected seat not found.", 404);
    if (seat.status === "occupied") throw new AppError("Selected seat is already occupied.", 400);

    patientData.status = "admitted";
    patientData.roomName = seat.roomName;
    patientData.bedName = seat.bedName;
  }

  const patient = await Patient.create(patientData);

  // If inpatient, mark the seat as occupied
  if (body.type === "inpatient" && body.seatId) {
    await Seat.findByIdAndUpdate(body.seatId, {
      status: "occupied",
      patientId: patient._id,
      patientName: patient.name,
    });
  }

  // Log activity
  await logActivity({
    type: "patient",
    description: `New ${body.type} patient registered: ${patient.name} (${patientId})`,
    operator: user.name,
    operatorId: user._id,
    refId: patient._id,
    refModel: "Patient",
  });

  // Trigger admission SMS for inpatient
  if (body.phone && body.type === "inpatient") {
    sendSingleSms(
      body.phone,
      `Dear ${patient.name}, you have been admitted. Patient ID: ${patientId}. Room: ${patient.roomName || "N/A"}, Bed: ${patient.bedName || "N/A"}. We wish you a speedy recovery.`,
      {
        type: "admission",
        refId: patient._id,
        refModel: "Patient",
        sentBy: user._id,
        sentByName: user.name
      }
    ).catch((err) => console.error("Admission SMS trigger failed:", err.message));
  }

  return patient;

};

const updatePatient = async (id, body) => {
  const patient = await Patient.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  });
  if (!patient) throw new AppError("Patient not found.", 404);
  return patient;
};

const deletePatient = async (id, user) => {
  const patient = await Patient.findById(id);
  if (!patient) throw new AppError("Patient not found.", 404);

  // If patient has an active seat, free it
  if (patient.seatId) {
    await Seat.findByIdAndUpdate(patient.seatId, {
      status: "vacant",
      patientId: null,
      patientName: null,
    });
  }

  await Patient.findByIdAndDelete(id);

  await logActivity({
    type: "patient",
    description: `Patient deleted: ${patient.name} (${patient.patientId})`,
    operator: user.name,
    operatorId: user._id,
    refId: patient._id,
    refModel: "Patient",
  });
};

const dischargePatient = async (id, user) => {
  const patient = await Patient.findById(id);
  if (!patient) throw new AppError("Patient not found.", 404);
  if (patient.status !== "admitted") throw new AppError("Patient is not currently admitted.", 400);

  // Free the seat
  if (patient.seatId) {
    await Seat.findByIdAndUpdate(patient.seatId, {
      status: "vacant",
      patientId: null,
      patientName: null,
    });
  }

  // Update patient status
  patient.status = "discharged";
  patient.seatId = null;
  await patient.save();

  await logActivity({
    type: "discharge",
    description: `Patient discharged: ${patient.name} from ${patient.roomName || "N/A"}, ${patient.bedName || "N/A"}`,
    operator: user.name,
    operatorId: user._id,
    refId: patient._id,
    refModel: "Patient",
  });

  // Trigger discharge SMS
  if (patient.phone) {
    sendSingleSms(
      patient.phone,
      `Dear ${patient.name}, you have been discharged. Patient ID: ${patient.patientId}. We wish you good health. Thank you for choosing us.`,
      {
        type: "discharge",
        refId: patient._id,
        refModel: "Patient",
        sentBy: user._id,
        sentByName: user.name
      }
    ).catch((err) => console.error("Discharge SMS trigger failed:", err.message));
  }

  return patient;

};

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  dischargePatient,
};
