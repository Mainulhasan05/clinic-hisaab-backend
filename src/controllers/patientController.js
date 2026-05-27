const patientService = require("../services/patientService");
const sendResponse = require("../utils/sendResponse");

const getAllPatients = async (req, res, next) => {
  try {
    const result = await patientService.getAllPatients(req.query);
    sendResponse(res, 200, "Patients fetched.", result);
  } catch (error) { next(error); }
};

const getPatientById = async (req, res, next) => {
  try {
    const patient = await patientService.getPatientById(req.params.id);
    sendResponse(res, 200, "Patient fetched.", patient);
  } catch (error) { next(error); }
};

const createPatient = async (req, res, next) => {
  try {
    const patient = await patientService.createPatient(req.body, req.user);
    sendResponse(res, 201, "Patient created.", patient);
  } catch (error) { next(error); }
};

const updatePatient = async (req, res, next) => {
  try {
    const patient = await patientService.updatePatient(req.params.id, req.body);
    sendResponse(res, 200, "Patient updated.", patient);
  } catch (error) { next(error); }
};

const deletePatient = async (req, res, next) => {
  try {
    await patientService.deletePatient(req.params.id, req.user);
    sendResponse(res, 200, "Patient deleted.");
  } catch (error) { next(error); }
};

const dischargePatient = async (req, res, next) => {
  try {
    const patient = await patientService.dischargePatient(req.params.id, req.user, req.body);
    sendResponse(res, 200, "Patient discharged.", patient);
  } catch (error) { next(error); }
};

module.exports = { getAllPatients, getPatientById, createPatient, updatePatient, deletePatient, dischargePatient };
