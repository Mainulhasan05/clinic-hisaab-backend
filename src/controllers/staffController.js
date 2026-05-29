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

const paySalary = async (req, res, next) => {
  try {
    const expense = await staffService.paySalary(req.params.id, req.body, req.user);
    sendResponse(res, 201, "Salary paid successfully.", expense);
  } catch (error) { next(error); }
};

const getSalaryHistory = async (req, res, next) => {
  try {
    const history = await staffService.getSalaryHistory(req.params.id);
    sendResponse(res, 200, "Salary history fetched.", history);
  } catch (error) { next(error); }
};

const getSalaryReport = async (req, res, next) => {
  try {
    const report = await staffService.getSalaryReport(req.query);
    sendResponse(res, 200, "Salary report fetched.", report);
  } catch (error) { next(error); }
};

module.exports = { getAllStaff, createStaff, updateStaff, deleteStaff, paySalary, getSalaryHistory, getSalaryReport };
