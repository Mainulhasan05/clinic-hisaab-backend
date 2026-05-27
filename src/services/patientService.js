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
  // Check for existing patient with same name, phone, and gender (case-insensitive name comparison)
  const existingPatient = await Patient.findOne({
    name: { $regex: new RegExp(`^${escapeRegex(body.name.trim())}$`, "i") },
    phone: body.phone.trim(),
    gender: body.gender,
  });

  if (existingPatient) {
    // If inpatient with a seat, set status to "admitted" and occupy the seat
    if (body.type === "inpatient" && body.seatId) {
      const seat = await Seat.findById(body.seatId);
      if (!seat) throw new AppError("Selected seat not found.", 404);
      if (seat.status === "occupied") throw new AppError("Selected seat is already occupied.", 400);

      // If the patient is already admitted to another seat, check/prevent
      if (existingPatient.status === "admitted" && existingPatient.seatId && existingPatient.seatId.toString() !== body.seatId) {
        throw new AppError("Patient is already admitted to another seat. Please discharge them first.", 400);
      }

      existingPatient.type = "inpatient";
      existingPatient.status = "admitted";
      existingPatient.seatId = body.seatId;
      existingPatient.roomName = seat.roomName;
      existingPatient.bedName = seat.bedName;
      existingPatient.admissionDate = body.admissionDate || new Date();
      if (body.guardianName) existingPatient.guardianName = body.guardianName;
      if (body.guardianPhone) existingPatient.guardianPhone = body.guardianPhone;
      if (body.emergencyContact) existingPatient.emergencyContact = body.emergencyContact;
      if (body.referenceDoctor) existingPatient.referenceDoctor = body.referenceDoctor;

      await existingPatient.save();

      // Occupy the seat
      await Seat.findByIdAndUpdate(body.seatId, {
        status: "occupied",
        patientId: existingPatient._id,
        patientName: existingPatient.name,
      });

      // Log activity
      await logActivity({
        type: "admission",
        description: `Existing patient admitted: ${existingPatient.name} (${existingPatient.patientId})`,
        operator: user.name,
        operatorId: user._id,
        refId: existingPatient._id,
        refModel: "Patient",
      });

      // Trigger admission SMS for inpatient
      if (existingPatient.phone) {
        sendSingleSms(
          existingPatient.phone,
          `Dear ${existingPatient.name}, you have been admitted. Patient ID: ${existingPatient.patientId}. Room: ${existingPatient.roomName || "N/A"}, Bed: ${existingPatient.bedName || "N/A"}. We wish you a speedy recovery.`,
          {
            type: "admission",
            refId: existingPatient._id,
            refModel: "Patient",
            sentBy: user._id,
            sentByName: user.name
          }
        ).catch((err) => console.error("Admission SMS trigger failed:", err.message));
      }
    } else {
      // If type or other minor fields need updating (e.g. age can change over time, or address), update if provided
      let updated = false;
      if (body.age && body.age !== existingPatient.age) {
        existingPatient.age = body.age;
        updated = true;
      }
      if (body.address && body.address !== existingPatient.address) {
        existingPatient.address = body.address;
        updated = true;
      }
      if (updated) {
        await existingPatient.save();
      }

      // Log activity
      await logActivity({
        type: "patient",
        description: `Existing patient returned for service: ${existingPatient.name} (${existingPatient.patientId})`,
        operator: user.name,
        operatorId: user._id,
        refId: existingPatient._id,
        refModel: "Patient",
      });
    }

    return existingPatient;
  }

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
