const seatService = require("../services/seatService");
const sendResponse = require("../utils/sendResponse");

const getAllSeats = async (req, res, next) => {
  try {
    const result = await seatService.getAllSeats(req.query);
    sendResponse(res, 200, "Seats fetched.", result);
  } catch (error) { next(error); }
};

const createSeat = async (req, res, next) => {
  try {
    const seat = await seatService.createSeat(req.body, req.user);
    sendResponse(res, 201, "Seat created.", seat);
  } catch (error) { next(error); }
};

const updateSeat = async (req, res, next) => {
  try {
    const seat = await seatService.updateSeat(req.params.id, req.body, req.user);
    sendResponse(res, 200, "Seat updated.", seat);
  } catch (error) { next(error); }
};

module.exports = { getAllSeats, createSeat, updateSeat };
