require("dotenv").config();
const connectDB = require("./config/db");
const Invoice = require("./models/Invoice");

const deleteOldInvoices = async () => {
  try {
    await connectDB();

    const cutoffDate = new Date("2026-07-01T00:00:00.000Z");
    console.log(`⏳ Querying invoices created before ${cutoffDate.toISOString()} (July 1, 2026)...`);

    const count = await Invoice.countDocuments({ createdAt: { $lt: cutoffDate } });
    console.log(`🔍 Found ${count} invoices matching the deletion criteria.`);

    if (count > 0) {
      const result = await Invoice.deleteMany({ createdAt: { $lt: cutoffDate } });
      console.log(`🎉 Successfully deleted ${result.deletedCount} invoices.`);
    } else {
      console.log("ℹ️ No invoices found prior to July 2026.");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Deletion process failed with error:", error);
    process.exit(1);
  }
};

deleteOldInvoices();
