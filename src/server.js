require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const { healOrphanedSeats } = require("./services/patientService");

const PORT = process.env.PORT || 5000;

// Connect to MongoDB, then start the server
connectDB().then(async () => {
  // ── Startup consistency check ──
  // Heals any orphaned seat↔patient records left from crashes,
  // interrupted requests, or past frontend-driven bugs.
  try {
    await healOrphanedSeats();
  } catch (err) {
    console.error("⚠️ Consistency check failed (non-fatal):", err.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 NurseBill API running on port ${PORT} (${process.env.NODE_ENV})`);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err.message);
    server.close(() => process.exit(1));
  });

  // Handle SIGTERM (graceful shutdown)
  process.on("SIGTERM", () => {
    console.log("🛑 SIGTERM received. Shutting down gracefully...");
    server.close(() => process.exit(0));
  });
});
