/**
 * Seat model — represents a room/bed in the nursing home.
 *
 * Each seat has a roomName + bedName combination that must be unique.
 * Example: Room 1 / Bed A, Room 1 / Bed B, Room 2 / Bed A.
 *
 * When a patient is admitted, the seat status changes to "occupied"
 * and the patientId/patientName fields are filled.
 * When discharged, it goes back to "vacant" with null patient fields.
 */
const mongoose = require("mongoose");
const { SEAT_STATUSES } = require("../utils/constants");

const seatSchema = new mongoose.Schema(
  {
    roomName: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
    },
    bedName: {
      type: String,
      required: [true, "Bed name is required"],
      trim: true,
    },
    dailyRate: {
      type: Number,
      required: [true, "Daily rate is required"],
      min: [0, "Daily rate cannot be negative"],
    },
    status: {
      type: String,
      enum: SEAT_STATUSES,
      default: "vacant",
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      default: null,
    },
    patientName: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure no duplicate room+bed combinations
seatSchema.index({ roomName: 1, bedName: 1 }, { unique: true });
seatSchema.index({ status: 1 });

module.exports = mongoose.model("Seat", seatSchema);
