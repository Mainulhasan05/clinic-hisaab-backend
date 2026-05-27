const authService = require("../services/authService");
const sendResponse = require("../utils/sendResponse");

const setup = async (req, res, next) => {
  try {
    const result = await authService.setup(req.body);
    sendResponse(res, 201, "System setup complete. Owner account created.", result);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    sendResponse(res, 200, "Login successful.", result);
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user._id);
    sendResponse(res, 200, "User fetched.", user);
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body);
    sendResponse(res, 200, "OTP sent successfully to your phone number.", result);
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.body);
    sendResponse(res, 200, "Password has been reset successfully. You can now log in.", result);
  } catch (error) {
    next(error);
  }
};

module.exports = { setup, login, getMe, forgotPassword, resetPassword };
