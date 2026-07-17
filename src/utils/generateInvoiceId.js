/**
 * Generates the next invoice ID in the format: INV-YYYYMMDD-NNNN
 * Examples: INV-20260711-0001, INV-20260718-0002
 *
 * Daily-resetting sequential invoice generator.
 */
const Invoice = require("../models/Invoice");
const Counter = require("../models/Counter");

const generateInvoiceId = async () => {
  const d = new Date();
  
  // Format as YYYYMMDD in Asia/Dhaka local timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === "year").value;
  const month = parts.find(p => p.type === "month").value;
  const day = parts.find(p => p.type === "day").value;
  
  const dateKey = `${year}${month}${day}`;
  const counterId = `invoice-${dateKey}`;

  const existingCounter = await Counter.findById(counterId).select("seq");
  if (!existingCounter) {
    // Check database for any invoices that might have been generated on this day to seed the sequence
    const lastInvoice = await Invoice.findOne({ invoiceId: { $regex: `^INV-${dateKey}-` } })
      .sort({ invoiceId: -1 })
      .select("invoiceId");

    let maxNumber = 0;
    if (lastInvoice && lastInvoice.invoiceId) {
      const idParts = lastInvoice.invoiceId.split("-");
      const lastNumber = parseInt(idParts[2], 10);
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
  return `INV-${dateKey}-${padded}`;
};

module.exports = generateInvoiceId;
