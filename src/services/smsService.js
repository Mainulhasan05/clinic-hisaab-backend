const axios = require("axios");
const SmsLog = require("../models/SmsLog");
const AppError = require("../utils/AppError");
const escapeRegex = require("../utils/escapeRegex");

/**
 * Normalize phone number to Bangladeshi international format without '+' (e.g. 88017XXXXXXXX)
 */
const normalizePhoneNumber = (phone) => {
  if (!phone || typeof phone !== "string") return "";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11 && clean.startsWith("0")) {
    return `88${clean}`;
  }
  return clean;
};


/**
 * Call the MimSMS Gateway API.
 * Encapsulates the credentials and network call.
 * 
 * @param {string} endpoint - API endpoint path (e.g. "/api/SmsSending/SMS")
 * @param {object} payload - Body params specific to the request
 * @returns {Promise<object>} response metadata { success, statusCode, trxnId, responseResult, errorMessage }
 */
const _callMimSmsApi = async (endpoint, payload) => {
  const username = process.env.MIMSMS_USERNAME;
  const apiKey = process.env.MIMSMS_APIKEY;
  const baseUrl = process.env.MIMSMS_BASE_URL || "https://api.mimsms.com";

  if (!username || !apiKey) {
    return {
      success: false,
      statusCode: "401",
      errorMessage: "Missing MimSMS credentials (MIMSMS_USERNAME or MIMSMS_APIKEY) in environment configuration."
    };
  }

  try {
    const fullUrl = `${baseUrl.replace(/\/$/, "")}${endpoint}`;
    const body = {
      UserName: username,
      Apikey: apiKey,
      ...payload
    };

    const response = await axios.post(fullUrl, body, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 10000 // 10 second timeout
    });

    const data = response.data;
    // MimSMS returns statusCode as string, e.g. "200", check flexibly
    const code = String(data.statusCode || data.StatusCode || "");
    const isSuccess = code === "200";

    return {
      success: isSuccess,
      statusCode: code,
      trxnId: data.trxnId || data.TrxnId || null,
      responseResult: data.responseResult || data.ResponseResult || data.status || data.Status || "No response details"
    };
  } catch (error) {
    console.error("MimSMS API call error:", error.message);
    return {
      success: false,
      statusCode: "500",
      errorMessage: error.message || "Network error calling MimSMS API"
    };
  }
};

/**
 * Send a single SMS to a specific recipient.
 * 
 * @param {string} recipient - Recipient phone number (e.g., "88018xxxxxxxx")
 * @param {string} message - Message content
 * @param {object} options - Optional parameters (type, transactionType, campaignId, refId, refModel, sentBy, sentByName)
 * @returns {Promise<object>} Created SmsLog document
 */
const sendSingleSms = async (recipient, message, options = {}) => {
  const isEnabled = process.env.SMS_ENABLED !== "false";
  const type = options.type || "manual";
  const transactionType = options.transactionType || "T";
  const campaignId = options.campaignId || null;
  const refId = options.refId || null;
  const refModel = options.refModel || null;
  const sentBy = options.sentBy || null;
  const sentByName = options.sentByName || null;

  const cleanRecipient = normalizePhoneNumber(recipient);
  if (!cleanRecipient) {
    throw new AppError("Invalid or empty recipient phone number", 400);
  }

  if (!isEnabled) {
    const log = await SmsLog.create({
      recipient: cleanRecipient,
      message,
      type,
      transactionType,
      campaignId,
      status: "skipped",
      statusCode: "skipped",
      errorMessage: "SMS sending is disabled via SMS_ENABLED env flag.",
      refId,
      refModel,
      sentBy,
      sentByName
    });
    return log;
  }

  const username = process.env.MIMSMS_USERNAME;
  const apiKey = process.env.MIMSMS_APIKEY;
  if (!username || !apiKey) {
    const log = await SmsLog.create({
      recipient: cleanRecipient,
      message,
      type,
      transactionType,
      campaignId,
      status: "failed",
      statusCode: "401",
      errorMessage: "Missing MimSMS credentials (MIMSMS_USERNAME or MIMSMS_APIKEY) in environment configuration.",
      refId,
      refModel,
      sentBy,
      sentByName
    });
    return log;
  }

  const payload = {
    MobileNumber: cleanRecipient,
    CampaignId: campaignId || "null",
    SenderName: process.env.MIMSMS_SENDER_NAME || "NurseBill",
    TransactionType: transactionType,
    Message: message
  };

  const result = await _callMimSmsApi("/api/SmsSending/SMS", payload);

  const log = await SmsLog.create({
    recipient: cleanRecipient,
    message,
    type,
    transactionType,
    campaignId,
    trxnId: result.trxnId,
    status: result.success ? "sent" : "failed",
    statusCode: result.statusCode,
    errorMessage: result.success ? null : (result.errorMessage || result.responseResult),
    refId,
    refModel,
    sentBy,
    sentByName
  });

  return log;
};

/**
 * Send the same message to multiple recipients.
 * 
 * @param {string[]} recipients - Array of phone numbers
 * @param {string} message - Message content
 * @param {object} options - Optional parameters (type, transactionType, campaignId, refId, refModel, sentBy, sentByName)
 * @returns {Promise<object[]>} Array of created SmsLog documents
 */
const sendBulkSms = async (recipients, message, options = {}) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new AppError("Recipients list must be a non-empty array", 400);
  }

  const isEnabled = process.env.SMS_ENABLED !== "false";
  const type = options.type || "marketing";
  const transactionType = options.transactionType || "T";
  const campaignId = options.campaignId || null;
  const refId = options.refId || null;
  const refModel = options.refModel || null;
  const sentBy = options.sentBy || null;
  const sentByName = options.sentByName || null;

  const cleanRecipients = recipients.map(normalizePhoneNumber).filter(Boolean);
  if (cleanRecipients.length === 0) {
    throw new AppError("No valid recipients provided after normalization", 400);
  }

  if (!isEnabled) {
    const logsData = cleanRecipients.map(recipient => ({
      recipient,
      message,
      type,
      transactionType,
      campaignId,
      status: "skipped",
      statusCode: "skipped",
      errorMessage: "SMS sending is disabled via SMS_ENABLED env flag.",
      refId,
      refModel,
      sentBy,
      sentByName
    }));
    const logs = await SmsLog.insertMany(logsData);
    return logs;
  }

  const username = process.env.MIMSMS_USERNAME;
  const apiKey = process.env.MIMSMS_APIKEY;
  if (!username || !apiKey) {
    const logsData = recipients.map(recipient => ({
      recipient,
      message,
      type,
      transactionType,
      campaignId,
      status: "failed",
      statusCode: "401",
      errorMessage: "Missing MimSMS credentials (MIMSMS_USERNAME or MIMSMS_APIKEY) in environment configuration.",
      refId,
      refModel,
      sentBy,
      sentByName
    }));
    const logs = await SmsLog.insertMany(logsData);
    return logs;
  }

  const payload = {
    MobileNumber: cleanRecipients.join(","),
    CampaignId: campaignId || "null",
    SenderName: process.env.MIMSMS_SENDER_NAME || "NurseBill",
    TransactionType: transactionType,
    Message: message
  };

  const result = await _callMimSmsApi("/api/SmsSending/OneToMany", payload);

  const logsData = cleanRecipients.map(recipient => ({
    recipient,
    message,
    type,
    transactionType,
    campaignId,
    trxnId: result.trxnId,
    status: result.success ? "sent" : "failed",
    statusCode: result.statusCode,
    errorMessage: result.success ? null : (result.errorMessage || result.responseResult),
    refId,
    refModel,
    sentBy,
    sentByName
  }));

  const logs = await SmsLog.insertMany(logsData);
  return logs;
};

/**
 * Send custom messages to individual recipients dynamically (different message per recipient).
 * 
 * @param {object[]} smsDataArray - Array of objects: { recipient, message }
 * @param {object} options - Optional parameters (type, refId, refModel, sentBy, sentByName)
 * @returns {Promise<object[]>} Array of created SmsLog documents
 */
const sendDynamicSms = async (smsDataArray, options = {}) => {
  if (!Array.isArray(smsDataArray) || smsDataArray.length === 0) {
    throw new AppError("smsData must be a non-empty array", 400);
  }

  const isEnabled = process.env.SMS_ENABLED !== "false";
  const type = options.type || "marketing";
  const refId = options.refId || null;
  const refModel = options.refModel || null;
  const sentBy = options.sentBy || null;
  const sentByName = options.sentByName || null;

  const cleanSmsDataArray = smsDataArray
    .map(item => ({
      recipient: normalizePhoneNumber(item.recipient),
      message: item.message
    }))
    .filter(item => item.recipient && item.message);

  if (cleanSmsDataArray.length === 0) {
    throw new AppError("No valid dynamic SMS records provided after normalization", 400);
  }

  if (!isEnabled) {
    const logsData = cleanSmsDataArray.map(item => ({
      recipient: item.recipient,
      message: item.message,
      type,
      transactionType: "D",
      status: "skipped",
      statusCode: "skipped",
      errorMessage: "SMS sending is disabled via SMS_ENABLED env flag.",
      refId,
      refModel,
      sentBy,
      sentByName
    }));
    const logs = await SmsLog.insertMany(logsData);
    return logs;
  }

  const username = process.env.MIMSMS_USERNAME;
  const apiKey = process.env.MIMSMS_APIKEY;
  if (!username || !apiKey) {
    const logsData = smsDataArray.map(item => ({
      recipient: item.recipient,
      message: item.message,
      type,
      transactionType: "D",
      status: "failed",
      statusCode: "401",
      errorMessage: "Missing MimSMS credentials (MIMSMS_USERNAME or MIMSMS_APIKEY) in environment configuration.",
      refId,
      refModel,
      sentBy,
      sentByName
    }));
    const logs = await SmsLog.insertMany(logsData);
    return logs;
  }

  // Transform to MimSMS format: { MobNumber, Message }
  const mimSmsData = cleanSmsDataArray.map(item => ({
    MobNumber: item.recipient,
    Message: item.message
  }));

  const payload = {
    SenderName: process.env.MIMSMS_SENDER_NAME || "NurseBill",
    TransactionType: "D",
    SmsData: mimSmsData
  };

  const result = await _callMimSmsApi("/api/SmsSending/DSMS", payload);

  const logsData = cleanSmsDataArray.map(item => ({
    recipient: item.recipient,
    message: item.message,
    type,
    transactionType: "D",
    trxnId: result.trxnId,
    status: result.success ? "sent" : "failed",
    statusCode: result.statusCode,
    errorMessage: result.success ? null : (result.errorMessage || result.responseResult),
    refId,
    refModel,
    sentBy,
    sentByName
  }));

  const logs = await SmsLog.insertMany(logsData);
  return logs;
};

/**
 * Check balance of MimSMS Gateway.
 * 
 * @returns {Promise<object>} Balance details { balance, statusCode }
 */
const checkBalance = async () => {
  if (process.env.SMS_ENABLED === "false") {
    return { balance: "0.00 BDT (SMS Disabled)", status: "skipped" };
  }

  const result = await _callMimSmsApi("/api/SmsSending/balanceCheck", {});
  if (!result.success) {
    throw new AppError(result.errorMessage || result.responseResult || "Failed to check balance", 400);
  }

  return {
    balance: result.responseResult,
    statusCode: result.statusCode
  };
};

/**
 * Get paginated SMS logs matching given filter options.
 */
const getSmsLogs = async ({ type, status, recipient, startDate, endDate, page = 1, limit = 20 }) => {
  const filter = {};

  if (type) {
    filter.type = type;
  }
  if (status) {
    filter.status = status;
  }
  if (recipient) {
    filter.recipient = { $regex: escapeRegex(recipient), $options: "i" };
  }
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    SmsLog.find(filter)
      .populate("sentBy", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    SmsLog.countDocuments(filter)
  ]);

  return {
    logs,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit)
  };
};

/**
 * Get details of a single SMS log by ID.
 */
const getSmsLogById = async (id) => {
  const log = await SmsLog.findById(id).populate("sentBy", "name email role");
  if (!log) {
    throw new AppError("SMS log not found.", 404);
  }
  return log;
};

/**
 * Get total logs aggregation count by status and type.
 */
const getSmsStats = async ({ startDate, endDate } = {}) => {
  const filter = {};
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const stats = await SmsLog.aggregate([
    { $match: filter },
    {
      $facet: {
        byStatus: [
          { $group: { _id: "$status", count: { $sum: 1 } } }
        ],
        byType: [
          { $group: { _id: "$type", count: { $sum: 1 } } }
        ],
        total: [
          { $count: "count" }
        ]
      }
    }
  ]);

  const result = {
    total: stats[0]?.total[0]?.count || 0,
    byStatus: {
      sent: 0,
      failed: 0,
      pending: 0,
      skipped: 0
    },
    byType: {
      billing: 0,
      admission: 0,
      discharge: 0,
      password_reset: 0,
      marketing: 0,
      manual: 0
    }
  };

  if (stats[0]?.byStatus) {
    stats[0].byStatus.forEach(item => {
      if (item._id in result.byStatus) {
        result.byStatus[item._id] = item.count;
      }
    });
  }

  if (stats[0]?.byType) {
    stats[0].byType.forEach(item => {
      if (item._id in result.byType) {
        result.byType[item._id] = item.count;
      }
    });
  }

  return result;
};

module.exports = {
  sendSingleSms,
  sendBulkSms,
  sendDynamicSms,
  checkBalance,
  getSmsLogs,
  getSmsLogById,
  getSmsStats
};
