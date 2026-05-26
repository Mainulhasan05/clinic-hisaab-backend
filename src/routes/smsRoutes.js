const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/smsController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const {
  sendSmsSchema,
  sendBulkSmsSchema,
  sendDynamicSmsSchema
} = require("../validations/smsValidation");

// All SMS routes require authentication
router.use(authenticate);

// Send operations — owner/manager only
router.post("/send", authorize("owner", "manager"), validate(sendSmsSchema), ctrl.sendSms);
router.post("/send-bulk", authorize("owner", "manager"), validate(sendBulkSmsSchema), ctrl.sendBulkSms);
router.post("/send-dynamic", authorize("owner", "manager"), validate(sendDynamicSmsSchema), ctrl.sendDynamicSms);

// Read operations & stats
router.get("/balance", authorize("owner", "manager"), ctrl.checkBalance);
router.get("/logs", ctrl.getSmsLogs);
router.get("/logs/:id", ctrl.getSmsLogById);
router.get("/stats", authorize("owner", "manager"), ctrl.getSmsStats);

module.exports = router;
