const Invoice = require("../models/Invoice");
const AppError = require("../utils/AppError");
const generateInvoiceId = require("../utils/generateInvoiceId");
const escapeRegex = require("../utils/escapeRegex");
const { logActivity } = require("./activityService");
const { sendSingleSms } = require("./smsService");
const { getSettings } = require("./settingsService");


/**
 * Calculate invoice status from payment amounts.
 */
const calculateStatus = (paidAmount, totalAmount) => {
  if (paidAmount >= totalAmount) return "paid";
  if (paidAmount > 0) return "partial";
  return "unpaid";
};

const getAllInvoices = async ({ search = "", filterStatus = "all", dateRange = "all", page = 1, limit = 20 }) => {
  page = Math.max(parseInt(page, 10) || 1, 1);
  limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = {};
  if (filterStatus !== "all") filter.status = filterStatus;
  if (search) {
    const escapedSearch = escapeRegex(search);
    filter.$or = [
      { patientName: { $regex: escapedSearch, $options: "i" } },
      { invoiceId: { $regex: escapedSearch, $options: "i" } },
      { patientPhone: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  // Date range filtering
  if (dateRange && dateRange !== "all") {
    const now = new Date();
    let startDate, endDate;

    switch (dateRange) {
      case "today": {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      }
      case "yesterday": {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case "last7": {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      }
      case "last30": {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      }
      case "thisMonth": {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      }
      default:
        break;
    }

    if (startDate && endDate) {
      filter.createdAt = { $gte: startDate, $lt: endDate };
    }
  }

  const skip = (page - 1) * limit;
  const [invoices, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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

  // ── Data integrity: paidAmount must NEVER exceed totalAmount ──
  const totalAmount = Math.max(0, Number(body.totalAmount) || 0);
  const paidAmount = Math.min(Math.max(0, Number(body.paidAmount) || 0), totalAmount);
  const dueAmount = Math.max(0, totalAmount - paidAmount);
  const status = calculateStatus(paidAmount, totalAmount);

  const invoice = await Invoice.create({
    ...body,
    invoiceId,
    totalAmount,
    paidAmount,
    dueAmount,
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

  // Fire-and-forget SMS notification
  if (body.patientPhone && body.sendSms) {
    let clinicName = "Nobab Nursing Home";
    try {
      const settings = await getSettings();
      if (settings && settings.name) {
        clinicName = settings.name;
      }
    } catch (err) {
      console.error("Failed to get settings for SMS:", err.message);
    }
    sendSingleSms(
      body.patientPhone,
      `Dear ${body.patientName}, your bill of ৳${body.totalAmount} has been generated at ${clinicName}. Invoice: ${invoiceId}. Paid: ৳${body.paidAmount || 0}. Due: ৳${body.totalAmount - (body.paidAmount || 0)}. Thank you.`,
      {
        type: "billing",
        refId: invoice._id,
        refModel: "Invoice",
        sentBy: user._id,
        sentByName: user.name
      }
    ).catch((err) => console.error("Billing SMS trigger failed:", err.message));
  }

  return invoice;

};

const updateInvoice = async (id, body, user) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError("Invoice not found.", 404);

  if (body.status === "cancelled") {
    if (invoice.status === "cancelled") {
      return invoice;
    }
    invoice.status = "cancelled";
    invoice.cancelReason = body.cancelReason || "";
    invoice.cancelledAt = new Date();
    invoice.cancelledBy = user?._id || null;
    invoice.cancelledByName = user?.name || "";
    await invoice.save();

    await logActivity({
      type: "billing",
      description: `Invoice ${invoice.invoiceId} cancelled (${invoice.patientName})`,
      operator: user?.name || "System",
      operatorId: user?._id,
      refId: invoice._id,
      refModel: "Invoice",
    });

    return invoice;
  }

  if (invoice.status === "cancelled") {
    throw new AppError("Cancelled invoices cannot be modified.", 400);
  }

  // Update simple payment fields
  const simpleFields = ["paidAmount", "dueAmount", "paymentMethod", "discountAmount", "totalAmount", "subtotalAmount"];
  simpleFields.forEach((field) => {
    if (body[field] !== undefined) {
      invoice[field] = body[field];
    }
  });

  // Update tests if provided (replace entire array)
  if (body.tests !== undefined) {
    invoice.tests = body.tests;
  }

  // Update admission charges if provided
  if (body.admissionCharges !== undefined) {
    invoice.admissionCharges = body.admissionCharges;
  }

  // Update seat charge if provided
  if (body.seatCharge !== undefined) {
    invoice.seatCharge = body.seatCharge;
  }

  // ── Data integrity: paidAmount must NEVER exceed totalAmount ──
  const totalAmount = Math.max(0, Number(invoice.totalAmount) || 0);
  const paidAmount = Math.min(Math.max(0, Number(invoice.paidAmount) || 0), totalAmount);
  invoice.totalAmount = totalAmount;
  invoice.paidAmount = paidAmount;
  invoice.status = calculateStatus(paidAmount, totalAmount);
  invoice.dueAmount = Math.max(0, totalAmount - paidAmount);

  await invoice.save();

  await logActivity({
    type: "billing",
    description: `Invoice ${invoice.invoiceId} corrected (${invoice.patientName})${body.correctionReason ? `: ${body.correctionReason}` : ""}`,
    operator: user?.name || "System",
    operatorId: user?._id,
    refId: invoice._id,
    refModel: "Invoice",
  });

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
