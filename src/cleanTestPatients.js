require("dotenv").config();
const connectDB = require("./config/db");
const Patient = require("./models/Patient");
const Invoice = require("./models/Invoice");
const Seat = require("./models/Seat");
const SmsLog = require("./models/SmsLog");

const cleanTestPatients = async () => {
  try {
    await connectDB();

    const realPatientSerials = ["PT-2026-00021", "PT-2026-00022"];
    const realPhones = ["01614809066", "01787269957", "1614809066", "1787269957"];

    console.log("⏳ Beginning database cleanup of test patient records...");

    // 1. Fetch real patients to get their ObjectIds
    const realPatients = await Patient.find({ patientId: { $in: realPatientSerials } });
    const realPatientIds = realPatients.map(p => p._id);
    console.log(`🔍 Found ${realPatients.length} real patient records in database.`);

    // 2. Delete test patients
    const patientDeleteResult = await Patient.deleteMany({
      patientId: { $nin: realPatientSerials }
    });
    console.log(`🗑️ Deleted ${patientDeleteResult.deletedCount} test patient records.`);

    // 3. Delete test invoices
    const invoiceDeleteResult = await Invoice.deleteMany({
      patientSerial: { $nin: realPatientSerials }
    });
    console.log(`🗑️ Deleted ${invoiceDeleteResult.deletedCount} test invoice/receipt records.`);

    // 4. Delete test SMS logs
    const smsDeleteResult = await SmsLog.deleteMany({
      recipient: { $nin: realPhones }
    });
    console.log(`🗑️ Deleted ${smsDeleteResult.deletedCount} test SMS log records.`);

    // 5. Reset all seat allocations since the two real patients are lab patients
    const seatResetResult = await Seat.updateMany(
      {},
      {
        status: "vacant",
        patientId: null,
        patientName: null,
        patientPhone: null,
        admissionId: null,
        assignedAt: null,
      }
    );
    console.log(`🛋️ Reset ${seatResetResult.modifiedCount} seats to vacant status.`);

    console.log("🎉 Database cleanup successfully completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Cleanup failed with error:", error);
    process.exit(1);
  }
};

cleanTestPatients();
