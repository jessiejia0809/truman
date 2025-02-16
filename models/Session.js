const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" }, // an optional description of the session
  },
  { versionKey: false },
);

const Session = mongoose.model("Session", sessionSchema);
module.exports = Session;
