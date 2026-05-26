const Seat = require("../models/Seat");
const AppError = require("../utils/AppError");
const { logActivity } = require("./activityService");

const getAllSeats = async ({ filterStatus = "all" }) => {
  const filter = {};
  if (filterStatus !== "all") filter.status = filterStatus;
  return Seat.find(filter).sort({ roomName: 1, bedName: 1 });
};

const createSeat = async (body, user) => {
  const seat = await Seat.create(body);
  await logActivity({
    type: "seat",
    description: `New seat created: ${seat.roomName} / ${seat.bedName} (৳${seat.dailyRate}/day)`,
    operator: user.name,
    operatorId: user._id,
    refId: seat._id,
    refModel: "Seat",
  });
  return seat;
};

const updateSeat = async (id, body, user) => {
  const seat = await Seat.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!seat) throw new AppError("Seat not found.", 404);
  return seat;
};

module.exports = { getAllSeats, createSeat, updateSeat };
