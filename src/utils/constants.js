/**
 * All enums and constants used across the app.
 *
 * WHY: Single source of truth for all allowed values.
 * If a value is not in these lists, it is invalid.
 * Joi validations and Mongoose enums both reference these.
 */

const ROLES = ["owner", "manager", "operator"];

const USER_STATUSES = ["active", "inactive"];

const PATIENT_TYPES = ["lab", "inpatient"];

const PATIENT_STATUSES = ["active", "admitted", "discharged"];

const GENDERS = ["Male", "Female", "Other"];

const SEAT_STATUSES = ["vacant", "occupied"];

const INVOICE_STATUSES = ["paid", "partial", "unpaid", "cancelled"];

const RECEIPT_TYPES = ["lab", "admission"];

const PAYMENT_METHODS = ["Cash", "bKash", "Nagad", "Card", "Bank", "Other"];

const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "medical_supplies",
  "staff_salaries",
  "equipment",
  "food",
  "miscellaneous",
];

const ACTIVITY_TYPES = [
  "billing",
  "admission",
  "discharge",
  "payment",
  "expense",
  "patient",
  "staff",
  "test",
  "seat",
  "doctor",
];

module.exports = {
  ROLES,
  USER_STATUSES,
  PATIENT_TYPES,
  PATIENT_STATUSES,
  GENDERS,
  SEAT_STATUSES,
  INVOICE_STATUSES,
  RECEIPT_TYPES,
  PAYMENT_METHODS,
  EXPENSE_CATEGORIES,
  ACTIVITY_TYPES,
};
