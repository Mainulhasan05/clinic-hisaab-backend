const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/labTestController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { createTestSchema, updateTestSchema } = require("../validations/labTestValidation");

// All routes require authentication
router.use(authenticate);

router.get("/", ctrl.getAllTests);
router.get("/customers", authorize("owner", "manager"), ctrl.getTestCustomerGroups);
router.get("/customer-records", authorize("owner", "manager"), ctrl.getTestCustomerRecords);
router.post("/", authorize("owner"), validate(createTestSchema), ctrl.createTest);
router.put("/:id", authorize("owner"), validate(updateTestSchema), ctrl.updateTest);
router.delete("/:id", authorize("owner"), ctrl.deleteTest);

module.exports = router;
