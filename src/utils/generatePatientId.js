const Patient = require("../models/Patient");
const Counter = require("../models/Counter");

const generatePatientId = async () => {
  const year = new Date().getFullYear();
  const prefix = `PT-${year}-`;
  const counterId = `patient-${year}`;

  const existingCounter = await Counter.findById(counterId).select("seq");
  if (!existingCounter) {
    const lastPatient = await Patient.findOne({
      patientId: { $regex: `^PT-${year}-` },
    })
      .sort({ patientId: -1 })
      .select("patientId");

    let maxNumber = 0;
    if (lastPatient && lastPatient.patientId) {
      const parts = lastPatient.patientId.split("-");
      const lastNumber = parseInt(parts[2], 10);
      if (!isNaN(lastNumber)) {
        maxNumber = lastNumber;
      }
    }

    try {
      await Counter.create({ _id: counterId, seq: maxNumber });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `${prefix}${String(counter.seq).padStart(5, "0")}`;
};

module.exports = generatePatientId;
