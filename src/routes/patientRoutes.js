const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/patientController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { createPatientSchema, updatePatientSchema } = require("../validations/patientValidation");

// All routes require authentication
router.use(authenticate);

router.get("/", ctrl.getAllPatients);
router.get("/:id", ctrl.getPatientById);
router.post("/", validate(createPatientSchema), ctrl.createPatient);
router.put("/:id", validate(updatePatientSchema), ctrl.updatePatient);
router.delete("/:id", authorize("owner", "manager"), ctrl.deletePatient);
router.put("/:id/discharge", authorize("owner", "manager"), ctrl.dischargePatient);
router.put("/:id/admit", authorize("owner", "manager"), ctrl.admitPatient);

module.exports = router;
