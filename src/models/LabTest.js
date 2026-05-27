/**
 * LabTest model — the catalog of available lab tests.
 *
 * Examples: "Complete Blood Count (CBC)" at ৳800, "ECG" at ৳500.
 *
 * When a test is "deleted" by the owner, we don't actually remove it
 * from the database — we set isActive to false. This is called "soft delete".
 * WHY? Because old invoices reference these tests by name. If we hard-delete,
 * old invoices would have orphaned test references.
 */
const mongoose = require("mongoose");

const labTestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Test name is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Test price is required"],
      min: [0, "Price cannot be negative"],
    },
    category: {
      type: String,
      default: "General",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

labTestSchema.index({ isActive: 1, category: 1 });
labTestSchema.index({ name: 1 });

module.exports = mongoose.model("LabTest", labTestSchema);
