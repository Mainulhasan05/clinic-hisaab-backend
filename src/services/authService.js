const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Settings = require("../models/Settings");
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

module.exports = { setup, login, getMe };
