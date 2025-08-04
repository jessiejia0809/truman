const mongoose = require("mongoose");
const { Schema } = mongoose;

const objectiveSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: false, // ✅ make optional to allow level-wide objectives
  },
  taskType: {
    type: String,
    enum: ["dm", "comment"],
    required: true,
  },
  targetAgent: {
    type: Schema.Types.ObjectId,
    ref: "Agent",
    required: true,
  },
  targetAgentUsername: {
    type: String,
    required: false, // ✅ useful for debugging + user-facing views
  },
  goalCategory: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true, // ✅ user-facing short text (e.g., checklist)
  },
  description: {
    type: String,
    required: true, // ✅ full objective instruction
  },
  details: {
    type: String,
    required: false, // ✅ optional for additional context or hints
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
  },
  level: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model("Objective", objectiveSchema);
