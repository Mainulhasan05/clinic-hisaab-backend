const staffService = require("../services/staffService");
const sendResponse = require("../utils/sendResponse");

const getAllStaff = async (req, res, next) => {
  try {
    const result = await staffService.getAllStaff(req.query);
    sendResponse(res, 200, "Staff fetched.", result);
  } catch (error) { next(error); }
};

const createStaff = async (req, res, next) => {
  try {
    const staff = await staffService.createStaff(req.body, req.user);
    sendResponse(res, 201, "Staff created.", staff);
  } catch (error) { next(error); }
};

const updateStaff = async (req, res, next) => {
  try {
    const staff = await staffService.updateStaff(req.params.id, req.body, req.user);
    sendResponse(res, 200, "Staff updated.", staff);
  } catch (error) { next(error); }
};

const deleteStaff = async (req, res, next) => {
  try {
    await staffService.deleteStaff(req.params.id, req.user);
    sendResponse(res, 200, "Staff deleted.");
  } catch (error) { next(error); }
};

module.exports = { getAllStaff, createStaff, updateStaff, deleteStaff };
