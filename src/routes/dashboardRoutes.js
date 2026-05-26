const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/dashboardController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

// All routes require authentication
router.use(authenticate);

router.get("/stats", ctrl.getDashboardStats);
router.get("/daily-sales", authorize("owner", "manager"), ctrl.getDailySales);
router.get("/analytics", authorize("owner"), ctrl.getAnalytics);
router.get("/recent-activity", ctrl.getRecentActivity);

module.exports = router;
