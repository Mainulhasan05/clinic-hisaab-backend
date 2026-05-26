const mongoose = require("mongoose");

const smsLogSchema = new mongoose.Schema(
  {
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["billing", "admission", "discharge", "password_reset", "marketing", "manual"],
    },
    transactionType: {
      type: String,
      required: true,
      enum: ["T", "P", "D"],
      default: "T",
    },
    campaignId: {
      type: String,
      default: null,
    },
    trxnId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ["sent", "failed", "pending", "skipped"],
      default: "pending",
    },
    statusCode: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    refModel: {
      type: String,
      default: null,
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sentByName: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast querying
smsLogSchema.index({ type: 1, createdAt: -1 });
smsLogSchema.index({ recipient: 1 });
smsLogSchema.index({ trxnId: 1 });
smsLogSchema.index({ status: 1 });
smsLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("SmsLog", smsLogSchema);
