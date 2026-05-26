const settingsService = require("../services/settingsService");
const sendResponse = require("../utils/sendResponse");

const getSettings = async (req, res, next) => {
  try {
    const result = await settingsService.getSettings();
    sendResponse(res, 200, "Settings fetched.", result);
  } catch (error) { next(error); }
};

const updateSettings = async (req, res, next) => {
  try {
    const result = await settingsService.updateSettings(req.body);
    sendResponse(res, 200, "Settings updated.", result);
  } catch (error) { next(error); }
};

module.exports = { getSettings, updateSettings };
