const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const sessionSchema = new mongoose.Schema(
  {
    sessionID: { type: String, required: true },
    description: { type: String, default: "" }, // optional description specifying what is session is used for

  },
  { versionKey: false },
);

const Session = mongoose.model("Session", sessionSchema);
module.exports = Session;