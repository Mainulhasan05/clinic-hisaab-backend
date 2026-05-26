const express = require("express");
const router = express.Router();
const { setup, login, getMe } = require("../controllers/authController");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const { setupSchema, loginSchema } = require("../validations/authValidation");

router.post("/setup", validate(setupSchema), setup);
router.post("/login", validate(loginSchema), login);
router.get("/me", authenticate, getMe);

module.exports = router;
