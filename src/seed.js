/**
 * Seed script — populates the database with sample data for development.
 * Run with: node src/seed.js
 *
 * WARNING: This will DELETE all existing data and replace it with seed data.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");

const Settings = require("./models/Settings");
const User = require("./models/User");
const Patient = require("./models/Patient");
const LabTest = require("./models/LabTest");
const Seat = require("./models/Seat");
const Invoice = require("./models/Invoice");
const Expense = require("./models/Expense");
const ActivityLog = require("./models/ActivityLog");

const seedDB = async () => {
  await connectDB();

  // Clear all collections
  await Settings.deleteMany({});
  await User.deleteMany({});
  await Patient.deleteMany({});
  await LabTest.deleteMany({});
  await Seat.deleteMany({});
  await Invoice.deleteMany({});
  await Expense.deleteMany({});
  await ActivityLog.deleteMany({});

  console.log("🗑️  Cleared all collections.");

  // Drop old unique email index if it exists
  try {
    await mongoose.connection.db.collection("users").dropIndex("email_1");
    console.log("🗑️  Dropped old unique email index.");
  } catch (err) {
    // Index doesn't exist, ignore
  }


  // 1. Create Settings
  await Settings.create({
    name: "Green Care Nursing Home",
    address: "12 Hospital Road, Dhaka 1205",
    phone: "02-8765432, 01700-000000",
    registrationNo: "Reg. No: DGH-2026-1205",
    logoText: "GC",
    isSetupComplete: true,
  });
  console.log("✅ Settings created.");

  // 2. Create Users (passwords will be hashed by pre-save hook)
  await User.create([
    { name: "Fatima Rahman", password: "password123", role: "owner", phone: "01711111111" },
    { name: "Sadia Akter", password: "password123", role: "manager", phone: "01722222222" },
    { name: "Rafiq Islam", password: "password123", role: "operator", phone: "01733333333" },
  ]);
  console.log("✅ Users created (3 staff members).");


  // 3. Create Lab Tests
  await LabTest.create([
    { name: "Complete Blood Count (CBC)", price: 800, category: "Hematology" },
    { name: "Blood Sugar (Fasting)", price: 300, category: "Biochemistry" },
    { name: "Blood Sugar (Random)", price: 300, category: "Biochemistry" },
    { name: "Urine R/E", price: 250, category: "Microbiology" },
    { name: "Serum Creatinine", price: 500, category: "Biochemistry" },
    { name: "Lipid Profile", price: 1200, category: "Biochemistry" },
    { name: "Thyroid Function (T3, T4, TSH)", price: 1800, category: "Endocrinology" },
    { name: "Chest X-Ray", price: 600, category: "Radiology" },
    { name: "ECG", price: 500, category: "Cardiology" },
    { name: "HbA1c", price: 900, category: "Biochemistry" },
  ]);
  console.log("✅ Lab tests created (10 tests).");

  // 4. Create Seats
  await Seat.create([
    { roomName: "Room 1", bedName: "Bed A", dailyRate: 500 },
    { roomName: "Room 1", bedName: "Bed B", dailyRate: 500 },
    { roomName: "Room 2", bedName: "Bed A", dailyRate: 800 },
    { roomName: "Room 2", bedName: "Bed B", dailyRate: 800 },
    { roomName: "Room 3", bedName: "Bed A", dailyRate: 600 },
    { roomName: "Room 3", bedName: "Bed B", dailyRate: 600 },
    { roomName: "Room 4", bedName: "Bed A", dailyRate: 1000 },
    { roomName: "Room 4", bedName: "Bed B", dailyRate: 1000 },
    { roomName: "Room 5", bedName: "Bed A", dailyRate: 700 },
    { roomName: "Room 5", bedName: "Bed B", dailyRate: 700 },
  ]);
  console.log("✅ Seats created (10 beds in 5 rooms).");

  console.log("\n🎉 Seed complete! You can now run: npm run dev");
  console.log("   Login with: 01711111111 / password123");


  process.exit(0);
};

seedDB().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
