/**
 * ActivityLog model — audit trail of all important actions.
 *
 * Every time someone creates a patient, generates a bill, adds an expense,
 * admits or discharges a patient — an ActivityLog entry is created.
 *
 * The dashboard "Recent Activity" section reads from this collection.
 */
const mongoose = require("mongoose");
const { ACTIVITY_TYPES } = require("../utils/constants");

const activityLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ACTIVITY_TYPES,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    operator: {
      type: String,
      required: true,
      trim: true,
    },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    refModel: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast "recent activity" queries (newest first)
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
