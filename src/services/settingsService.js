const Settings = require("../models/Settings");

const getSettings = async () => {
  const settings = await Settings.findOne({});
  // If no settings exist yet (fresh install before setup), return defaults
  if (!settings) {
    return {
      name: "Nobab Nursing Home",
      address: "",
      phone: "",
      registrationNo: "",
      logoText: "NNH",
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
