const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/expenseController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { createExpenseSchema } = require("../validations/expenseValidation");

// All routes require authentication and owner/manager authorization
router.use(authenticate, authorize("owner", "manager"));

router.get("/", ctrl.getAllExpenses);
router.get("/summary", ctrl.getExpenseSummary);
router.post("/", validate(createExpenseSchema), ctrl.createExpense);
router.delete("/:id", ctrl.deleteExpense);

module.exports = router;
