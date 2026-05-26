const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/seatController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { createSeatSchema, updateSeatSchema } = require("../validations/seatValidation");

// All routes require authentication
router.use(authenticate);

router.get("/", ctrl.getAllSeats);
router.post("/", authorize("owner"), validate(createSeatSchema), ctrl.createSeat);
router.put("/:id", authorize("owner"), validate(updateSeatSchema), ctrl.updateSeat);

module.exports = router;
