const Seat = require("../models/Seat");
const Patient = require("../models/Patient");
const AppError = require("../utils/AppError");
const { logActivity } = require("./activityService");

const getAllSeats = async ({ filterStatus = "all" }) => {
  const filter = {};
  if (filterStatus !== "all") filter.status = filterStatus;
  return Seat.find(filter).sort({ roomName: 1, bedName: 1 });
};

const createSeat = async (body, user) => {
  const seat = await Seat.create(body);
  await logActivity({
    type: "seat",
    description: `New seat created: ${seat.roomName} / ${seat.bedName} (৳${seat.dailyRate}/day)`,
    operator: user.name,
    operatorId: user._id,
    refId: seat._id,
    refModel: "Seat",
  });
  return seat;
};

/**
 * Update seat configuration (roomName, bedName, dailyRate) ONLY.
 *
 * BLOCKED FIELDS:
 *   - status, patientId, patientName — these are managed exclusively by
 *     the patient admission/discharge flow in patientService.
 *
 * This prevents the frontend from directly toggling a seat between
 * "occupied" and "vacant", which caused orphaned seat bugs.
 */
const updateSeat = async (id, body, user) => {
  // ── Guard: block direct occupancy manipulation ──
  if (body.status !== undefined) {
    throw new AppError(
      "Cannot change seat status directly. Use patient admit/discharge endpoints.",
      400
    );
  }
  if (body.patientId !== undefined || body.patientName !== undefined) {
    throw new AppError(
      "Cannot change seat patient assignment directly. Use patient admit/discharge endpoints.",
      400
    );
  }

  // Only allow configuration fields
  const safeFields = ["roomName", "bedName", "dailyRate"];
  const updateData = {};
  for (const field of safeFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError("No valid fields to update.", 400);
  }

  const seat = await Seat.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  if (!seat) throw new AppError("Seat not found.", 404);

  // If seat is occupied and room/bed name changed, sync the patient record
  if (seat.status === "occupied" && seat.patientId && (updateData.roomName || updateData.bedName)) {
    await Patient.findByIdAndUpdate(seat.patientId, {
      ...(updateData.roomName ? { roomName: seat.roomName } : {}),
      ...(updateData.bedName ? { bedName: seat.bedName } : {}),
    });
  }

  return seat;
};

const deleteSeat = async (id, user) => {
  const seat = await Seat.findById(id);
  if (!seat) throw new AppError("Seat not found.", 404);
  if (seat.status === "occupied" || seat.patientId) {
    throw new AppError("Occupied seats cannot be deleted. Discharge or move the patient first.", 400);
  }

  await Seat.findByIdAndDelete(id);

  await logActivity({
    type: "seat",
    description: `Seat deleted: ${seat.roomName} / ${seat.bedName}`,
    operator: user.name,
    operatorId: user._id,
    refId: seat._id,
    refModel: "Seat",
  });
};

module.exports = { getAllSeats, createSeat, updateSeat, deleteSeat };
