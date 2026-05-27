const express = require("express");
const router = express.Router();
const { setup, login, getMe, forgotPassword, resetPassword, updateProfile } = require("../controllers/authController");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const { setupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema } = require("../validations/authValidation");

router.post("/setup", validate(setupSchema), setup);
router.post("/login", validate(loginSchema), login);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.get("/me", authenticate, getMe);
router.put("/profile", authenticate, validate(updateProfileSchema), updateProfile);

module.exports = router;

