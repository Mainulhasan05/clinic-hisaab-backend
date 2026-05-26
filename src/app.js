const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const AppError = require("./utils/AppError");
const errorHandler = require("./middlewares/errorHandler");

// Import route files
const authRoutes = require("./routes/authRoutes");
const patientRoutes = require("./routes/patientRoutes");
const labTestRoutes = require("./routes/labTestRoutes");
const seatRoutes = require("./routes/seatRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const staffRoutes = require("./routes/staffRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const smsRoutes = require("./routes/smsRoutes");


const app = express();

// --- Global Middleware ---
app.use(helmet());

const corsOriginSetting = process.env.CORS_ORIGIN || "*";
const corsOrigin = corsOriginSetting.includes(",")
  ? corsOriginSetting.split(",").map((o) => o.trim())
  : corsOriginSetting;

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));

// Rate limiting for auth routes only
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: "Too many requests. Please try again later." },
});
app.use("/api/auth", authLimiter);

// --- Mount Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/lab-tests", labTestRoutes);
app.use("/api/seats", seatRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sms", smsRoutes);


// --- Health Check ---
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "NurseBill API is running." });
});

// --- 404 Handler ---
app.all("*", (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

// --- Global Error Handler ---
app.use(errorHandler);

module.exports = app;
