const Invoice = require("../models/Invoice");
const AppError = require("../utils/AppError");
const generateInvoiceId = require("../utils/generateInvoiceId");
const { logActivity } = require("./activityService");

/**
 * Calculate invoice status from payment amounts.
 */
const calculateStatus = (paidAmount, totalAmount) => {
  if (paidAmount >= totalAmount) return "paid";
  if (paidAmount > 0) return "partial";
  return "unpaid";
};

const getAllInvoices = async ({ search = "", filterStatus = "all", page = 1, limit = 20 }) => {
  const filter = {};
  if (filterStatus !== "all") filter.status = filterStatus;
  if (search) {
    filter.$or = [
      { patientName: { $regex: search, $options: "i" } },
      { invoiceId: { $regex: search, $options: "i" } },
      { patientPhone: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [invoices, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Invoice.countDocuments(filter),
  ]);

  return { invoices, total, page: Number(page), pages: Math.ceil(total / limit) };
};

const getInvoiceById = async (id) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError("Invoice not found.", 404);
  return invoice;
};

const createInvoice = async (body, user) => {
  const invoiceId = await generateInvoiceId();
  const status = calculateStatus(body.paidAmount || 0, body.totalAmount);

  const invoice = await Invoice.create({
    ...body,
    invoiceId,
    status,
    operatorId: user._id,
    operatorName: user.name,
  });

  await logActivity({
    type: "billing",
    description: `Invoice ${invoiceId} created for ${body.patientName} — ৳${body.totalAmount}`,
    operator: user.name,
    operatorId: user._id,
    refId: invoice._id,
    refModel: "Invoice",
  });

  return invoice;
};

const updateInvoice = async (id, body) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError("Invoice not found.", 404);

  // Update allowed fields
  Object.assign(invoice, body);

  // Recalculate status
  const totalAmount = body.totalAmount || invoice.totalAmount;
  const paidAmount = body.paidAmount !== undefined ? body.paidAmount : invoice.paidAmount;
  invoice.status = calculateStatus(paidAmount, totalAmount);
  invoice.dueAmount = Math.max(0, totalAmount - paidAmount);

  await invoice.save();
  return invoice;
};

const deleteInvoice = async (id, user) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError("Invoice not found.", 404);

  await Invoice.findByIdAndDelete(id);

  await logActivity({
    type: "billing",
    description: `Invoice ${invoice.invoiceId} deleted (${invoice.patientName})`,
    operator: user.name,
    operatorId: user._id,
    refId: invoice._id,
    refModel: "Invoice",
  });
};

module.exports = { getAllInvoices, getInvoiceById, createInvoice, updateInvoice, deleteInvoice };
