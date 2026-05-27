/**
 * User model — represents staff members who log in to the system.
 *
 * Roles:
 *   - "owner"    → Full access. Can manage staff, tests, seats, settings.
 *   - "manager"  → Can manage patients, billing, expenses. Cannot manage staff or settings.
 *   - "operator" → Can register patients and create bills. No delete permissions.
 *
 * SECURITY:
 *   - Password is ALWAYS hashed before saving (see pre-save hook below).
 *   - Password is NEVER included in query results unless explicitly selected.
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES, USER_STATUSES } = require("../utils/constants");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },

    role: {
      type: String,
      enum: ROLES,
      default: "operator",
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "active",
    },
    salary: {
      type: Number,
      default: 0,
      min: [0, "Salary cannot be negative"],
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Pre-save hook — hashes the password BEFORE saving to the database.
 *
 * HOW IT WORKS:
 * 1. Check if the password field was modified (or is new).
 * 2. If yes, hash it using bcrypt with the salt rounds from .env.
 * 3. If no (e.g., updating the name only), skip hashing.
 *
 * WHY "isModified"?
 * Without this check, the password would be double-hashed every time
 * we update ANY field on the user (e.g., changing their name).
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

/**
 * Instance method — compares a plain-text password with the stored hash.
 *
 * HOW TO USE:
 *   const user = await User.findOne({ phone }).select("+password");
 *   const isMatch = await user.comparePassword("plaintext123");
 *
 * WHY select("+password")?
 * Because we set `select: false` on the password field above,
 * we must explicitly ask for it when we need to compare passwords.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
