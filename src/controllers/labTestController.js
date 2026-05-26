const labTestService = require("../services/labTestService");
const sendResponse = require("../utils/sendResponse");

const getAllTests = async (req, res, next) => {
  try {
    const result = await labTestService.getAllTests(req.query);
    sendResponse(res, 200, "Lab tests fetched.", result);
  } catch (error) { next(error); }
};

const createTest = async (req, res, next) => {
  try {
    const test = await labTestService.createTest(req.body, req.user);
    sendResponse(res, 201, "Lab test created.", test);
  } catch (error) { next(error); }
};

const updateTest = async (req, res, next) => {
  try {
    const test = await labTestService.updateTest(req.params.id, req.body, req.user);
    sendResponse(res, 200, "Lab test updated.", test);
  } catch (error) { next(error); }
};

const deleteTest = async (req, res, next) => {
  try {
    await labTestService.deleteTest(req.params.id, req.user);
    sendResponse(res, 200, "Lab test deleted.");
  } catch (error) { next(error); }
};

module.exports = { getAllTests, createTest, updateTest, deleteTest };
