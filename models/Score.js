const mongoose = require("mongoose");

const ScoreSchema = new mongoose.Schema({
  level: { type: Number, required: true, unique: true },
  score: { type: Number, default: 0 },
  updated: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Score", ScoreSchema);
