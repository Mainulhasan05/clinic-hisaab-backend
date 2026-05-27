/**
 * Generates the next patient ID in the format: PT-YYYY-NNNNN
 * Examples: PT-2026-00001, PT-2026-00002, PT-2026-00103
 *
 * HOW IT WORKS:
 * 1. Find the patient with the highest numeric patientId for the current year.
 * 2. Increment to get the next number.
 * 3. If no patients exist yet, start at 1.
 *
 * RACE CONDITION SAFETY:
 * - Sort by patientId descending to always get the true maximum,
 *   even if two patients were created in the same millisecond.
 * - The Patient model has a unique index on patientId, so the DB
 *   will reject a duplicate if two requests still collide.
 *   The calling code should retry on duplicate key errors (E11000).
 */
const Patient = require("../models/Patient");

const generatePatientId = async () => {
  const year = new Date().getFullYear();
  const prefix = `PT-${year}-`;

  // Find the patient with the highest ID for the current year
  const lastPatient = await Patient.findOne({
    patientId: { $regex: `^PT-${year}-` },
  })
    .sort({ patientId: -1 })
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
  return `${prefix}${padded}`;
};

module.exports = generatePatientId;

