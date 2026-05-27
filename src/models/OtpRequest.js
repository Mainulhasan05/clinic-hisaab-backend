const mongoose = require("mongoose");

const otpRequestSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, "Phone is required"],
      index: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // TTL index: automatically deletes document after 10 minutes (600 seconds)
    },
  }
);

module.exports = mongoose.model("OtpRequest", otpRequestSchema);
