const Joi = require("joi");
const { RECEIPT_TYPES, PAYMENT_METHODS } = require("../utils/constants");

const testItemSchema = Joi.object({
  serial: Joi.number(),
  name: Joi.string().required(),
  price: Joi.number().min(0).required(),
});

const createInvoiceSchema = Joi.object({
  receiptType: Joi.string().valid(...RECEIPT_TYPES).required(),
  patientId: Joi.string().required(),
  patientSerial: Joi.string().required(),
  patientName: Joi.string().trim().required(),
  patientPhone: Joi.string().allow("").default(""),
  patientAge: Joi.number().allow(null),
  patientGender: Joi.string().allow("", null),
  patientAddress: Joi.string().allow("").default(""),
  doctorName: Joi.string().allow("", null).default(""),
  patientType: Joi.string().required(),
  tests: Joi.array().items(testItemSchema).default([]),
  seatCharge: Joi.object({
    roomName: Joi.string(),
    bedName: Joi.string(),
    dailyRate: Joi.number(),
    days: Joi.number(),
    total: Joi.number(),
  }).allow(null).default(null),
  admission: Joi.object().allow(null).default(null),
  admissionCharges: Joi.object().allow(null).default(null),
  subtotalAmount: Joi.number().min(0).required(),
  discountAmount: Joi.number().min(0).default(0),
  totalAmount: Joi.number().min(0).required(),
  paidAmount: Joi.number().min(0).default(0),
  dueAmount: Joi.number().min(0).default(0),
  paymentMethod: Joi.string().valid(...PAYMENT_METHODS).default("Cash"),
  paymentInWords: Joi.string().allow("").default(""),
  cashReceivedBy: Joi.string().default("Cash Counter"),
  authorizedBy: Joi.string().default("Duty Manager"),
  reportDeliveryAfter: Joi.string().allow(null, "").default(null),
  sendSms: Joi.boolean().default(false),
});

const updateInvoiceSchema = Joi.object({
  paidAmount: Joi.number().min(0),
  dueAmount: Joi.number().min(0),
  paymentMethod: Joi.string().valid(...PAYMENT_METHODS),
  discountAmount: Joi.number().min(0),
  totalAmount: Joi.number().min(0),
  subtotalAmount: Joi.number().min(0),
  tests: Joi.array().items(testItemSchema),
  admissionCharges: Joi.object().allow(null),
  seatCharge: Joi.object({
    roomName: Joi.string(),
    bedName: Joi.string(),
    dailyRate: Joi.number(),
    days: Joi.number(),
    total: Joi.number(),
  }).allow(null),
}).min(1);

module.exports = { createInvoiceSchema, updateInvoiceSchema };
