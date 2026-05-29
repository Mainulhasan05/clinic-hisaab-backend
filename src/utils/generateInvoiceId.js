/**
 * Generates the next invoice ID in the format: INV-YYYY-NNNN
 * Examples: INV-2026-0001, INV-2026-0452
 *
 * Same logic as generatePatientId but for invoices.
 */
const Invoice = require("../models/Invoice");
const Counter = require("../models/Counter");

const generateInvoiceId = async () => {
  const year = new Date().getFullYear();
  const counterId = `invoice-${year}`;

  const existingCounter = await Counter.findById(counterId).select("seq");
  if (!existingCounter) {
    const lastInvoice = await Invoice.findOne({ invoiceId: { $regex: `^INV-${year}-` } })
      .sort({ invoiceId: -1 })
      .select("invoiceId");

    let maxNumber = 0;
    if (lastInvoice && lastInvoice.invoiceId) {
      const parts = lastInvoice.invoiceId.split("-");
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
  const nextNumber = counter.seq;
  const padded = String(nextNumber).padStart(4, "0");
  return `INV-${year}-${padded}`;
};

module.exports = generateInvoiceId;
