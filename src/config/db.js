/**
 * Database connection module.
 *
 * WHAT IT DOES:
 * - Connects to MongoDB using the URI from .env
 * - Logs a success message with the hostname
 * - If connection fails, logs the error and kills the process
 *
 * WHY process.exit(1)?
 * If the database is unreachable, the API cannot serve any data.
 * It's better to crash immediately than serve broken responses.
 */
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
