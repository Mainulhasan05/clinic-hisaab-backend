const Patient = require("../models/Patient");
const Seat = require("../models/Seat");
const AppError = require("../utils/AppError");
const generatePatientId = require("../utils/generatePatientId");
const escapeRegex = require("../utils/escapeRegex");
const { logActivity } = require("./activityService");
const { sendSingleSms } = require("./smsService");
const { getSettings } = require("./settingsService");


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
  // ──────────────────────────────────────────────
  // STEP 1: Try to find existing patient
  // ──────────────────────────────────────────────
  // Priority 1: Frontend explicitly told us which patient to reuse
  // Priority 2: Fallback — match by name + phone + gender (same person returning)
  let existingPatient = null;

  if (body.existingPatientId) {
    existingPatient = await Patient.findById(body.existingPatientId);
  }

  if (!existingPatient) {
    existingPatient = await Patient.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(body.name.trim())}$`, "i") },
      phone: body.phone.trim(),
      gender: body.gender,
    });
  }

  // ──────────────────────────────────────────────
  // STEP 2: If existing patient found → reuse them
  // ──────────────────────────────────────────────
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
      if (body.advanceAmount > 0) {
        existingPatient.advanceAmount = body.advanceAmount;
        existingPatient.advancePaymentMethod = body.advancePaymentMethod || "Cash";
      }

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
      if (body.sendSms && existingPatient.phone) {
        let clinicName = "Nobab Nursing Home";
        try {
          const settings = await getSettings();
          if (settings && settings.name) {
            clinicName = settings.name;
          }
        } catch (err) {
          console.error("Failed to get settings for SMS:", err.message);
        }
        sendSingleSms(
          existingPatient.phone,
          `Dear ${existingPatient.name}, you have been admitted at ${clinicName}. Patient ID: ${existingPatient.patientId}. Room: ${existingPatient.roomName || "N/A"}, Bed: ${existingPatient.bedName || "N/A"}. We wish you a speedy recovery.`,
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
      if (body.referenceDoctor && body.referenceDoctor !== existingPatient.referenceDoctor) {
        existingPatient.referenceDoctor = body.referenceDoctor;
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

  // ──────────────────────────────────────────────
  // STEP 3: No existing patient found → create new
  // ──────────────────────────────────────────────
  // Retry loop to handle race conditions on patientId generation (E11000 duplicate key)
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const patientId = await generatePatientId();

      const patientData = {
        ...body,
        patientId,
        createdBy: user._id,
      };
      // Remove frontend-only field
      delete patientData.existingPatientId;

      // If inpatient with a seat, set status to "admitted" and occupy the seat
      if (body.type === "inpatient" && body.seatId) {
        const seat = await Seat.findById(body.seatId);
        if (!seat) throw new AppError("Selected seat not found.", 404);
        if (seat.status === "occupied") throw new AppError("Selected seat is already occupied.", 400);

        patientData.status = "admitted";
        patientData.roomName = seat.roomName;
        patientData.bedName = seat.bedName;
        if (body.advanceAmount > 0) {
          patientData.advanceAmount = body.advanceAmount;
          patientData.advancePaymentMethod = body.advancePaymentMethod || "Cash";
        }
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
      if (body.sendSms && body.phone && body.type === "inpatient") {
        let clinicName = "Nobab Nursing Home";
        try {
          const settings = await getSettings();
          if (settings && settings.name) {
            clinicName = settings.name;
          }
        } catch (err) {
          console.error("Failed to get settings for SMS:", err.message);
        }
        sendSingleSms(
          body.phone,
          `Dear ${patient.name}, you have been admitted at ${clinicName}. Patient ID: ${patientId}. Room: ${patient.roomName || "N/A"}, Bed: ${patient.bedName || "N/A"}. We wish you a speedy recovery.`,
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
    } catch (err) {
      // If it's a duplicate key error on patientId, retry with a new ID
      if (err.code === 11000 && err.keyPattern?.patientId && attempt < MAX_RETRIES) {
        console.warn(`PatientId collision on attempt ${attempt}, retrying...`);
        continue;
      }
      throw err;
    }
  }
};

/**
 * Update patient profile fields ONLY.
 *
 * BLOCKED TRANSITIONS (must use dedicated endpoints):
 *   - status → "discharged"  → use PUT /patients/:id/discharge
 *   - status → "admitted"    → use POST /patients (with seatId) or PUT /patients/:id/admit
 *   - seatId changes         → use admit/discharge endpoints
 *
 * This prevents frontend bugs or stale dispatches from leaving
 * seats in an inconsistent state.
 */
const updatePatient = async (id, body) => {
  // ── Guard: block direct status transitions that require seat sync ──
  if (body.status === "discharged") {
    throw new AppError(
      "Cannot set status to 'discharged' directly. Use the discharge endpoint (PUT /patients/:id/discharge).",
      400
    );
  }
  if (body.status === "admitted") {
    throw new AppError(
      "Cannot set status to 'admitted' directly. Use the admission flow (create patient with seatId or PUT /patients/:id/admit).",
      400
    );
  }

  // ── Guard: block direct seatId manipulation ──
  if (body.seatId !== undefined) {
    throw new AppError(
      "Cannot change seatId directly. Use admit/discharge endpoints for seat management.",
      400
    );
  }

  // Only allow safe profile fields through
  const safeFields = ["name", "age", "gender", "phone", "address", "referenceDoctor", "guardianName", "guardianPhone", "emergencyContact"];
  const updateData = {};
  for (const field of safeFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError("No valid fields to update.", 400);
  }

  const patient = await Patient.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });
  if (!patient) throw new AppError("Patient not found.", 404);

  // Keep seat patientName in sync if name changes and patient is admitted
  if (updateData.name && patient.seatId) {
    await Seat.findByIdAndUpdate(patient.seatId, { patientName: patient.name });
  }

  return patient;
};

/**
 * Admit a patient to a specific seat.
 * Handles all seat↔patient linkage atomically on the backend.
 */
const admitPatient = async (id, body, user) => {
  const { seatId, sendSms = false } = body;
  if (!seatId) throw new AppError("seatId is required to admit a patient.", 400);

  const patient = await Patient.findById(id);
  if (!patient) throw new AppError("Patient not found.", 404);

  // If already admitted to the same seat, no-op
  if (patient.status === "admitted" && patient.seatId && patient.seatId.toString() === seatId) {
    return patient;
  }

  // If already admitted to a different seat, block
  if (patient.status === "admitted" && patient.seatId) {
    throw new AppError("Patient is already admitted to another seat. Discharge them first.", 400);
  }

  const seat = await Seat.findById(seatId);
  if (!seat) throw new AppError("Selected seat not found.", 404);
  if (seat.status === "occupied") throw new AppError("Selected seat is already occupied.", 400);

  // Update patient
  patient.type = "inpatient";
  patient.status = "admitted";
  patient.seatId = seat._id;
  patient.roomName = seat.roomName;
  patient.bedName = seat.bedName;
  patient.admissionDate = body.admissionDate || new Date();
  if (body.guardianName) patient.guardianName = body.guardianName;
  if (body.guardianPhone) patient.guardianPhone = body.guardianPhone;
  if (body.emergencyContact) patient.emergencyContact = body.emergencyContact;
  await patient.save();

  // Occupy the seat
  await Seat.findByIdAndUpdate(seatId, {
    status: "occupied",
    patientId: patient._id,
    patientName: patient.name,
  });

  await logActivity({
    type: "admission",
    description: `Patient admitted: ${patient.name} (${patient.patientId}) to ${seat.roomName} / ${seat.bedName}`,
    operator: user.name,
    operatorId: user._id,
    refId: patient._id,
    refModel: "Patient",
  });

  // Trigger admission SMS
  if (sendSms && patient.phone) {
    let clinicName = "Nobab Nursing Home";
    try {
      const settings = await getSettings();
      if (settings && settings.name) clinicName = settings.name;
    } catch (err) {
      console.error("Failed to get settings for SMS:", err.message);
    }
    sendSingleSms(
      patient.phone,
      `Dear ${patient.name}, you have been admitted at ${clinicName}. Patient ID: ${patient.patientId}. Room: ${seat.roomName || "N/A"}, Bed: ${seat.bedName || "N/A"}. We wish you a speedy recovery.`,
      {
        type: "admission",
        refId: patient._id,
        refModel: "Patient",
        sentBy: user._id,
        sentByName: user.name,
      }
    ).catch((err) => console.error("Admission SMS trigger failed:", err.message));
  }

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

/**
 * Discharge a patient — the ONLY way to move a patient from "admitted" → "discharged".
 *
 * This is atomic: patient status, seatId, and the seat record are all
 * updated in one service call. The frontend does NOT need to make
 * separate seat update calls.
 */
const dischargePatient = async (id, user, body = {}) => {
  const { sendSms = false } = body;
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

  // Preserve room/bed names for historical reference but clear the active link
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
  if (sendSms && patient.phone) {
    let clinicName = "Nobab Nursing Home";
    try {
      const settings = await getSettings();
      if (settings && settings.name) {
        clinicName = settings.name;
      }
    } catch (err) {
      console.error("Failed to get settings for SMS:", err.message);
    }
    sendSingleSms(
      patient.phone,
      `Dear ${patient.name}, you have been discharged from ${clinicName}. Patient ID: ${patient.patientId}. We wish you good health. Thank you for choosing us.`,
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

/**
 * Consistency guard — heals orphaned seats on server startup.
 *
 * Scenarios this fixes:
 *   1. Seat says "occupied" with patientId, but that patient is discharged or doesn't exist.
 *   2. Patient says "admitted" with seatId, but that seat is vacant or doesn't exist.
 *
 * Runs once when the server boots. Logs every fix so admins can audit.
 */
const healOrphanedSeats = async () => {
  let fixed = 0;

  // ── Case 1: Seat is "occupied" but its patient is not actually admitted to it ──
  const occupiedSeats = await Seat.find({ status: "occupied" });
  for (const seat of occupiedSeats) {
    let shouldFree = false;
    let reason = "";

    if (!seat.patientId) {
      shouldFree = true;
      reason = "patientId is null";
    } else {
      const patient = await Patient.findById(seat.patientId);
      if (!patient) {
        shouldFree = true;
        reason = "patient record does not exist";
      } else if (patient.status !== "admitted") {
        shouldFree = true;
        reason = `patient status is '${patient.status}', not 'admitted'`;
      } else if (!patient.seatId || patient.seatId.toString() !== seat._id.toString()) {
        shouldFree = true;
        reason = "patient.seatId does not match this seat";
      }
    }

    if (shouldFree) {
      await Seat.findByIdAndUpdate(seat._id, {
        status: "vacant",
        patientId: null,
        patientName: null,
      });
      console.warn(`🔧 [Consistency] Freed orphaned seat ${seat.roomName}/${seat.bedName}: ${reason}`);
      fixed++;
    }
  }

  // ── Case 2: Patient is "admitted" but their seat doesn't reflect it ──
  const admittedPatients = await Patient.find({ status: "admitted" });
  for (const patient of admittedPatients) {
    if (!patient.seatId) {
      // Patient says admitted but has no seatId — mark as active (lab patient)
      patient.status = "active";
      patient.type = "lab";
      await patient.save();
      console.warn(`🔧 [Consistency] Patient ${patient.patientId} was 'admitted' with no seatId — reset to 'active'`);
      fixed++;
    } else {
      const seat = await Seat.findById(patient.seatId);
      if (!seat) {
        // Seat was deleted — clear the patient's seat reference
        patient.seatId = null;
        patient.status = "active";
        patient.type = "lab";
        await patient.save();
        console.warn(`🔧 [Consistency] Patient ${patient.patientId} referenced deleted seat — reset to 'active'`);
        fixed++;
      } else if (seat.status !== "occupied" || !seat.patientId || seat.patientId.toString() !== patient._id.toString()) {
        // Seat exists but doesn't point back to this patient — re-link
        await Seat.findByIdAndUpdate(seat._id, {
          status: "occupied",
          patientId: patient._id,
          patientName: patient.name,
        });
        console.warn(`🔧 [Consistency] Re-linked seat ${seat.roomName}/${seat.bedName} to patient ${patient.patientId}`);
        fixed++;
      }
    }
  }

  if (fixed > 0) {
    console.log(`🔧 [Consistency] Healed ${fixed} orphaned seat/patient record(s).`);
  } else {
    console.log("✅ [Consistency] All seat/patient records are consistent.");
  }

  return fixed;
};

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  admitPatient,
  deletePatient,
  dischargePatient,
  healOrphanedSeats,
};
