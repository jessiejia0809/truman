const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const sessionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  scenario: { type: Schema.ObjectId, ref: "Scenario" }, // scenario for the session
});

const Session = mongoose.model("Session", sessionSchema);
module.exports = Session;
