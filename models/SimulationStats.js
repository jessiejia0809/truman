const mongoose = require("mongoose");
const { Schema } = mongoose;

const SimulationStatsSchema = new Schema({
  bystanderScore: { type: Number, required: true },
  bullyScore: { type: Number, required: true },
  healthScore: { type: Number, required: true },
  bystanderScores: { type: Schema.Types.Mixed, required: true },
  bullyScores: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model("SimulationStats", SimulationStatsSchema);
