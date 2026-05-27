const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, "Phone is required"],
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: [true, "OTP code is required"],
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration time is required"],
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
