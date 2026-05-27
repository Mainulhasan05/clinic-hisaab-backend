const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Settings = require("../models/Settings");
const Otp = require("../models/Otp");
const OtpRequest = require("../models/OtpRequest");
const smsService = require("./smsService");
const AppError = require("../utils/AppError");

/**
 * Generate a JWT token for a user.
 */
const generateToken = (user) => {
  return jwt.sign(
    { _id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

/**
 * First-time setup — creates the owner account and initializes settings.
 * Can only be called ONCE (when no users exist in the database).
 */
const setup = async ({ nursingHomeName, ownerName, phone, password }) => {
  // Check if any users already exist
  const existingUserCount = await User.countDocuments({});
  if (existingUserCount > 0) {
    throw new AppError("System is already set up. Please use login.", 400);
  }

  // Create the settings document
  const settings = await Settings.create({
    name: nursingHomeName,
    isSetupComplete: true,
  });

  // Create the owner user
  const owner = await User.create({
    name: ownerName,
    phone,
    password, // Will be hashed by the pre-save hook
    role: "owner",
    status: "active",
  });

  const token = generateToken(owner);

  return {
    token,
    user: {
      _id: owner._id,
      name: owner.name,
      phone: owner.phone,
      role: owner.role,
    },
  };
};


/**
 * Login with email and password.
 */
const login = async ({ phone, password }) => {
  // Find user by phone (must explicitly select password since it's excluded by default)
  const user = await User.findOne({ phone }).select("+password");
  if (!user) {
    throw new AppError("Invalid phone or password.", 401);
  }

  if (user.status !== "active") {
    throw new AppError("Your account has been deactivated. Contact the administrator.", 401);
  }

  // Compare password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError("Invalid phone or password.", 401);
  }

  const token = generateToken(user);

  return {
    token,
    user: {
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  };
};


/**
 * Get current user info from the token.
 */
const getMe = async (userId) => {
  const user = await User.findById(userId).select("-password");
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  return user;
};

/**
 * Forgot password - request OTP code via SMS.
 */
const forgotPassword = async ({ phone }) => {
  // 1. Verify user exists
  const user = await User.findOne({ phone });
  if (!user) {
    throw new AppError("No account found with this phone number.", 404);
  }

  if (user.status !== "active") {
    throw new AppError("Your account is deactivated. Contact the administrator.", 401);
  }

  // 2. Count requests in last 10 minutes (handled automatically by TTL schema)
  const requestCount = await OtpRequest.countDocuments({ phone });
  if (requestCount >= 3) {
    throw new AppError("Too many OTP requests. Please wait 10 minutes.", 429);
  }

  // 3. Create OtpRequest entry (will TTL expire in 10m)
  await OtpRequest.create({ phone });

  // 4. Generate 6-digit OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // 5. Store OTP with 5 minutes expiration
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await Otp.findOneAndUpdate(
    { phone },
    { code, expiresAt },
    { upsert: true, new: true }
  );

  // 6. Send OTP via SMS
  const message = `Your Nobab Nursing Home password reset OTP is ${code}. Valid for 5 minutes. Do not share.`;
  await smsService.sendSingleSms(phone, message, { type: "password_reset" });

  return { success: true };
};

/**
 * Reset password using the SMS OTP code.
 */
const resetPassword = async ({ phone, otp, newPassword }) => {
  // 1. Check active OTP
  const otpRecord = await Otp.findOne({ phone });
  if (!otpRecord) {
    throw new AppError("No OTP requested for this phone number.", 400);
  }

  // Check expiration
  if (otpRecord.expiresAt < new Date()) {
    await Otp.deleteOne({ phone });
    throw new AppError("OTP has expired. Please request a new one.", 400);
  }

  // 2. Verify OTP matches
  if (otpRecord.code !== otp) {
    throw new AppError("Invalid OTP code.", 400);
  }

  // 3. Find User
  const user = await User.findOne({ phone });
  if (!user) {
    throw new AppError("User not found.", 404);
  }

  // 4. Update Password (pre-save hook will hash it)
  user.password = newPassword;
  await user.save();

  // 5. Clean up OTP record
  await Otp.deleteOne({ phone });

  return { success: true };
};


/**
 * Update own profile — name and/or password.
 */
const updateProfile = async (userId, { name, currentPassword, newPassword }) => {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new AppError("User not found.", 404);
  }

  // Update name if provided
  if (name) {
    user.name = name;
  }

  // Update password if provided (requires current password verification)
  if (newPassword) {
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError("Current password is incorrect.", 400);
    }
    user.password = newPassword; // pre-save hook will hash it
  }

  await user.save();

  // Return user without password
  const updatedUser = user.toObject();
  delete updatedUser.password;
  return updatedUser;
};

module.exports = { setup, login, getMe, forgotPassword, resetPassword, updateProfile };
