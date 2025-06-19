const mongoose = require("mongoose");
const { actorSchema } = require("./Actor");

const agentSchema = new mongoose.Schema(
  {
    // Extend the actor schema
    ...actorSchema.obj,

    role: { type: String, default: "user" },
    isLLMDriven: { type: Boolean, default: false },
    behaviorPrompt: { type: String, default: "" },
    // —— benevolence (7-point scale)
    PRS: { type: Number, min: 0, max: 7, default: null },
    CNT: { type: Number, min: 0, max: 7, default: null },
    ANX: { type: Number, min: 0, max: 7, default: null },
    VisitFreq: { type: Number, min: 0, max: 7, default: null },

    // —— bullying (5-point scale)
    AT: { type: Number, min: 1, max: 5, default: null },
    PBC: { type: Number, min: 1, max: 5, default: null },
    EMP: { type: Number, min: 1, max: 5, default: null },
    TIN: { type: Number, min: 1, max: 5, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * Helper method for getting user's gravatar.
 */
agentSchema.methods.gravatar = function gravatar(size) {
  if (!size) {
    size = 200;
  }
  if (!this.email) {
    return `https://gravatar.com/avatar/?s=${size}&d=retro`;
  }
  const md5 = crypto.createHash("md5").update(this.email).digest("hex");
  return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
};

const Agent = mongoose.model("Agent", agentSchema);
module.exports = Agent;
