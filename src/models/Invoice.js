/**
 * Invoice model — a billing receipt for a patient.
 *
 * Two receipt types:
 *   - "lab"       → Lab test receipt. Has tests[] but no admission charges.
 *   - "admission" → Inpatient receipt. Has tests[], admission info, seat charges.
 *
 * The status is DERIVED from payment amounts:
 *   - paidAmount >= totalAmount → "paid"
 *   - paidAmount > 0 but < totalAmount → "partial"
 *   - paidAmount === 0 → "unpaid"
 *
 * operatorId and operatorName are IMMUTABLE — they capture WHO created this
 * invoice and cannot be changed later. This is an audit trail requirement.
 */
const mongoose = require("mongoose");
const {
  INVOICE_STATUSES,
  RECEIPT_TYPES,
  PAYMENT_METHODS,
} = require("../utils/constants");

// Sub-schema for individual test items within an invoice
const testItemSchema = new mongoose.Schema(
  {
    serial: { type: Number },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false } // Don't create a separate _id for each test item
);

// Sub-schema for seat charge details
const seatChargeSchema = new mongoose.Schema(
  {
    roomName: String,
    bedName: String,
    dailyRate: Number,
    days: Number,
    total: Number,
  },
  { _id: false }
);

// Sub-schema for admission details
const admissionSchema = new mongoose.Schema(
  {
    admissionDate: Date,
    admissionTime: Date,
    guardianName: String,
    guardianPhone: String,
    admissionType: String,
    diseaseName: { type: String, default: "" },
    operationName: { type: String, default: "" },
    wardName: String,
    bedNumber: String,
    cabinNumber: { type: String, default: "" },
    status: { type: String, default: "admitted" },
    expectedDischargeDate: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

// Sub-schema for admission charge breakdown
const admissionChargesSchema = new mongoose.Schema(
  {
    admissionFee: { type: Number, default: 0 },
    surgeonCharge: { type: Number, default: 0 },
    anesthesiaCharge: { type: Number, default: 0 },
    otCharge: { type: Number, default: 0 },
    assistantCharge: { type: Number, default: 0 },
    bedRent: { type: Number, default: 0 },
    cabinRent: { type: Number, default: 0 },
    medicineCost: { type: Number, default: 0 },
    serviceCharge: { type: Number, default: 0 },
    vat: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      required: [true, "Invoice ID is required"],
      unique: true,
      trim: true,
    },
    receiptType: {
      type: String,
      required: true,
      enum: RECEIPT_TYPES,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: [true, "Patient reference is required"],
    },
    patientSerial: { type: String, required: true },
    patientName: { type: String, required: true, trim: true },
    patientPhone: { type: String, default: "" },
    patientAge: { type: Number },
    patientGender: { type: String },
    patientAddress: { type: String, default: "" },
    doctorName: { type: String, default: "" },
    patientType: { type: String, required: true },
    tests: [testItemSchema],
    seatCharge: { type: seatChargeSchema, default: null },
    admission: { type: admissionSchema, default: null },
    admissionCharges: { type: admissionChargesSchema, default: null },
    subtotalAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: "Cash",
    },
    paymentInWords: { type: String, default: "" },
    cashReceivedBy: { type: String, default: "Cash Counter" },
    authorizedBy: { type: String, default: "Duty Manager" },
    reportDeliveryAfter: { type: String, default: null },
    status: {
      type: String,
      enum: INVOICE_STATUSES,
      required: true,
    },
    // IMMUTABLE audit fields — set once at creation
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    operatorName: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ receiptType: 1, createdAt: -1 });
invoiceSchema.index({ dueAmount: 1 });
invoiceSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model("Invoice", invoiceSchema);
