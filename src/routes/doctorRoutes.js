const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/doctorController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { createDoctorSchema, updateDoctorSchema } = require("../validations/doctorValidation");

// Require authentication for all routes
router.use(authenticate);

// Read route for list (operators need access to populate the dropdown)
router.get("/", ctrl.getAllDoctors);

// Report query (limited to owner and manager)
router.get("/report", authorize("owner", "manager"), ctrl.getDoctorReport);

// Write/Configuration operations (limited to owner and manager)
router.post("/", authorize("owner", "manager"), validate(createDoctorSchema), ctrl.createDoctor);
router.put("/:id", authorize("owner", "manager"), validate(updateDoctorSchema), ctrl.updateDoctor);
router.delete("/:id", authorize("owner", "manager"), ctrl.deleteDoctor);

module.exports = router;
