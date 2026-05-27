const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/staffController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { createStaffSchema, updateStaffSchema, paySalarySchema } = require("../validations/staffValidation");

// All routes require authentication
router.use(authenticate);

// GET is accessible by both owner and manager
router.get("/", authorize("owner", "manager"), ctrl.getAllStaff);

// POST, PUT, DELETE are only accessible by owner
router.post("/", authorize("owner"), validate(createStaffSchema), ctrl.createStaff);
router.put("/:id", authorize("owner"), validate(updateStaffSchema), ctrl.updateStaff);
router.delete("/:id", authorize("owner"), ctrl.deleteStaff);

// Salary operations (owner only)
router.post("/:id/pay-salary", authorize("owner"), validate(paySalarySchema), ctrl.paySalary);
router.get("/:id/salary-history", authorize("owner"), ctrl.getSalaryHistory);

module.exports = router;
