require("dotenv").config();
const connectDB = require("./config/db");
const Doctor = require("./models/Doctor");

const doctorsToImport = [
  {
    name: "Dr. Yousuf Ali",
    degrees: "MBBS, BCS(Health)",
    designation: "Medical Officer",
    workplace: "",
    phone: "",
  },
  {
    name: "Dr. Nuri Zannatul Fardous",
    degrees: "MBBS, BCS(Health), MCPS(O&G)",
    designation: "Consultant (Gyne & Obs)",
    workplace: "Mother and Child Welfare Center(MCWC)",
    phone: "",
  },
  {
    name: "Dr. Md. Azizul Islam",
    degrees: "MBBS, BCS(Health), MS(Surgery), FACS(America), PHD(Urology)",
    designation: "Associate Professor",
    workplace: "250 Bed, Adhunik Sadar Hospital, Chapainawabgonj",
    phone: "",
  },
  {
    name: "Dr. Md. Robiul Alam",
    degrees: "MBBS, DO(Eye)",
    designation: "Ophthalmologist",
    workplace: "",
    phone: "",
  },
];

const importDoctors = async () => {
  try {
    await connectDB();

    console.log("⏳ Importing reference doctors...");
    let count = 0;

    for (const doc of doctorsToImport) {
      await Doctor.findOneAndUpdate(
        { name: doc.name },
        {
          name: doc.name,
          degrees: doc.degrees,
          designation: doc.designation,
          workplace: doc.workplace,
          phone: doc.phone,
          isActive: true,
        },
        { upsert: true, new: true }
      );
      count++;
    }

    console.log(`🎉 Successfully imported/synced ${count} reference doctors.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Import failed with error:", error);
    process.exit(1);
  }
};

importDoctors();
