const Settings = require("../models/Settings");

const getSettings = async () => {
  const settings = await Settings.findOne({});
  // If no settings exist yet (fresh install before setup), return defaults
  if (!settings) {
    return {
      name: "NurseBill",
      address: "",
      phone: "",
      registrationNo: "",
      logoText: "",
      isSetupComplete: false,
    };

  }
  return settings;
};

const updateSettings = async (body) => {
  const settings = await Settings.findOneAndUpdate({}, body, {
    new: true,
    upsert: true,
    runValidators: true,
  });
  return settings;
};

module.exports = { getSettings, updateSettings };
