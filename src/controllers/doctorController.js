const doctorService = require("../services/doctorService");
const sendResponse = require("../utils/sendResponse");

const getAllDoctors = async (req, res, next) => {
  try {
    const result = await doctorService.getAllDoctors(req.query);
    sendResponse(res, 200, "Reference doctors retrieved successfully.", result);
  } catch (error) {
    next(error);
  }
};

const createDoctor = async (req, res, next) => {
  try {
    const result = await doctorService.createDoctor(req.body, req.user);
    sendResponse(res, 201, "Reference doctor created successfully.", result);
  } catch (error) {
    next(error);
  }
};

const updateDoctor = async (req, res, next) => {
  try {
    const result = await doctorService.updateDoctor(req.params.id, req.body, req.user);
    sendResponse(res, 200, "Reference doctor updated successfully.", result);
  } catch (error) {
    next(error);
  }
};

const deleteDoctor = async (req, res, next) => {
  try {
    await doctorService.deleteDoctor(req.params.id, req.user);
    sendResponse(res, 200, "Reference doctor deactivated successfully.");
  } catch (error) {
    next(error);
  }
};

const getDoctorReport = async (req, res, next) => {
  try {
    const result = await doctorService.getDoctorReport(req.query);
    sendResponse(res, 200, "Doctor referrals report retrieved successfully.", result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorReport,
};
