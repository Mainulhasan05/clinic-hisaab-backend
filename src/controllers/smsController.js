const smsService = require("../services/smsService");
const sendResponse = require("../utils/sendResponse");

const sendSms = async (req, res, next) => {
  try {
    const { recipient, message, type } = req.body;
    const options = {
      type: type || "manual",
      sentBy: req.user?._id,
      sentByName: req.user?.name
    };
    const log = await smsService.sendSingleSms(recipient, message, options);
    sendResponse(res, 201, "SMS processed.", log);
  } catch (error) { next(error); }
};

const sendBulkSms = async (req, res, next) => {
  try {
    const { recipients, message, type, campaignId } = req.body;
    const options = {
      type: type || "marketing",
      campaignId,
      sentBy: req.user?._id,
      sentByName: req.user?.name
    };
    const logs = await smsService.sendBulkSms(recipients, message, options);
    sendResponse(res, 201, "Bulk SMS processed.", { count: logs.length, logs });
  } catch (error) { next(error); }
};

const sendDynamicSms = async (req, res, next) => {
  try {
    const { smsData, type } = req.body;
    const options = {
      type: type || "marketing",
      sentBy: req.user?._id,
      sentByName: req.user?.name
    };
    const logs = await smsService.sendDynamicSms(smsData, options);
    sendResponse(res, 201, "Dynamic SMS processed.", { count: logs.length, logs });
  } catch (error) { next(error); }
};

const checkBalance = async (req, res, next) => {
  try {
    const balanceInfo = await smsService.checkBalance();
    sendResponse(res, 200, "Balance checked successfully.", balanceInfo);
  } catch (error) { next(error); }
};

const getSmsLogs = async (req, res, next) => {
  try {
    const logsData = await smsService.getSmsLogs(req.query);
    sendResponse(res, 200, "SMS logs fetched.", logsData);
  } catch (error) { next(error); }
};

const getSmsLogById = async (req, res, next) => {
  try {
    const log = await smsService.getSmsLogById(req.params.id);
    sendResponse(res, 200, "SMS log details fetched.", log);
  } catch (error) { next(error); }
};

const getSmsStats = async (req, res, next) => {
  try {
    const stats = await smsService.getSmsStats(req.query);
    sendResponse(res, 200, "SMS stats fetched.", stats);
  } catch (error) { next(error); }
};

module.exports = {
  sendSms,
  sendBulkSms,
  sendDynamicSms,
  checkBalance,
  getSmsLogs,
  getSmsLogById,
  getSmsStats
};
