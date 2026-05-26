const express = require("express");
const router = Router = express.Router();
const ctrl = require("../controllers/settingsController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { updateSettingsSchema } = require("../validations/settingsValidation");

// All routes require authentication
router.use(authenticate);

router.get("/", ctrl.getSettings);
router.put("/", authorize("owner"), validate(updateSettingsSchema), ctrl.updateSettings);

module.exports = router;
