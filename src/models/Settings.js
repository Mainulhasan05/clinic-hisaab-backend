/**
 * Settings model — stores the nursing home's own configuration.
 *
 * IMPORTANT: Only ONE document should ever exist in this collection.
 * Services should use Settings.findOne({}) to get it.
 *
 * This stores the hospital name, address, phone, etc. that appear
 * on receipts and in the top bar of the frontend.
 */
const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Nursing home name is required"],
      trim: true,
    },
    address: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    registrationNo: { type: String, default: "", trim: true },
    logoText: { type: String, default: "", trim: true },
    isSetupComplete: { type: Boolean, default: false },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model("Settings", settingsSchema);
