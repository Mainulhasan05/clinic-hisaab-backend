const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/invoiceController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { createInvoiceSchema, updateInvoiceSchema } = require("../validations/invoiceValidation");

// All routes require authentication
router.use(authenticate);

router.get("/", ctrl.getAllInvoices);
router.get("/:id", ctrl.getInvoiceById);
router.post("/", authorize("owner", "manager", "operator"), validate(createInvoiceSchema), ctrl.createInvoice);
router.put("/:id", authorize("owner", "manager"), validate(updateInvoiceSchema), ctrl.updateInvoice);
router.delete("/:id", authorize("owner", "manager"), ctrl.deleteInvoice);

module.exports = router;
