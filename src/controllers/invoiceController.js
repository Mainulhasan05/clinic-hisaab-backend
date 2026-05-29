const invoiceService = require("../services/invoiceService");
const sendResponse = require("../utils/sendResponse");

const getAllInvoices = async (req, res, next) => {
  try {
    const result = await invoiceService.getAllInvoices(req.query);
    sendResponse(res, 200, "Invoices fetched.", result);
  } catch (error) { next(error); }
};

const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    sendResponse(res, 200, "Invoice fetched.", invoice);
  } catch (error) { next(error); }
};

const createInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.createInvoice(req.body, req.user);
    sendResponse(res, 201, "Invoice created.", invoice);
  } catch (error) { next(error); }
};

const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.updateInvoice(req.params.id, req.body, req.user);
    sendResponse(res, 200, "Invoice updated.", invoice);
  } catch (error) { next(error); }
};

const deleteInvoice = async (req, res, next) => {
  try {
    await invoiceService.deleteInvoice(req.params.id, req.user);
    sendResponse(res, 200, "Invoice deleted.");
  } catch (error) { next(error); }
};

module.exports = { getAllInvoices, getInvoiceById, createInvoice, updateInvoice, deleteInvoice };
