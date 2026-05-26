/**
 * Generates the next invoice ID in the format: INV-YYYY-NNNN
 * Examples: INV-2026-0001, INV-2026-0452
 *
 * Same logic as generatePatientId but for invoices.
 */
const Invoice = require("../models/Invoice");

const generateInvoiceId = async () => {
  const year = new Date().getFullYear();

  const lastInvoice = await Invoice.findOne({})
    .sort({ createdAt: -1 })
    .select("invoiceId");

  let nextNumber = 1;

  if (lastInvoice && lastInvoice.invoiceId) {
    const parts = lastInvoice.invoiceId.split("-");
    const lastNumber = parseInt(parts[2], 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  const padded = String(nextNumber).padStart(4, "0");
  return `INV-${year}-${padded}`;
};

module.exports = generateInvoiceId;
