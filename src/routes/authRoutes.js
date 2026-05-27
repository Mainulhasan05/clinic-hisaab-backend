const express = require("express");
const router = express.Router();
const { setup, login, getMe, forgotPassword, resetPassword } = require("../controllers/authController");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const { setupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require("../validations/authValidation");

router.post("/setup", validate(setupSchema), setup);
router.post("/login", validate(loginSchema), login);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.get("/me", authenticate, getMe);

module.exports = router;
