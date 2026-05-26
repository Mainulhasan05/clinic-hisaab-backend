/**
 * Generates the next patient ID in the format: PT-YYYY-NNNNN
 * Examples: PT-2026-00001, PT-2026-00002, PT-2026-00103
 *
 * HOW IT WORKS:
 * 1. Find the latest patient document, sorted by createdAt descending.
 * 2. Extract the numeric part from their patientId.
 * 3. Add 1 to get the next number.
 * 4. If no patients exist yet, start at 1.
 */
const Patient = require("../models/Patient");

const generatePatientId = async () => {
  const year = new Date().getFullYear();

  // Find the most recently created patient
  const lastPatient = await Patient.findOne({})
    .sort({ createdAt: -1 })
    .select("patientId");

  let nextNumber = 1;

  if (lastPatient && lastPatient.patientId) {
    // "PT-2026-00042" → split by "-" → ["PT", "2026", "00042"] → take "00042" → parse to 42
    const parts = lastPatient.patientId.split("-");
    const lastNumber = parseInt(parts[2], 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  // Pad to 5 digits: 1 → "00001", 42 → "00042"
  const padded = String(nextNumber).padStart(5, "0");
  return `PT-${year}-${padded}`;
};

module.exports = generatePatientId;
