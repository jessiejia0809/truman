const mongoose = require("mongoose");
const { actorSchema } = require("./Actor");

const clamp = (v, min, max) => {
  if (v == null) return null; // preserve null/default
  v = Math.floor(v); // or Math.round(v) if you prefer nearest
  return Math.min(max, Math.max(min, v));
};

const agentSchema = new mongoose.Schema(
  {
    // Extend the actor schema
    ...actorSchema.obj,

    role: { type: String, default: "user" },
    isLLMDriven: { type: Boolean, default: false },
    behaviorPrompt: { type: String, default: "" },

    level: {
      type: Number,
      default: null,
      set: (v) => (Number.isInteger(v) ? v : Math.floor(v)),
      min: 0,
    },

    // —— bystander (7-point scale)
    PRS: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 0, 7),
      min: 0,
      max: 7,
    },
    CNT: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 0, 7),
      min: 0,
      max: 7,
    },
    ANX: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 0, 7),
      min: 0,
      max: 7,
    },
    VisitFreq: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 0, 7),
      min: 0,
      max: 7,
    },

    // —— bullying (1–5 integer scale)
    AT: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 1, 5),
      min: 1,
      max: 5,
    },
    PBC: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 1, 5),
      min: 1,
      max: 5,
    },
    EMP: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 1, 5),
      min: 1,
      max: 5,
    },
    TIN: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 1, 5),
      min: 1,
      max: 5,
    },

    // —— victim support (0–1 scale)
    UES: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 0, 1),
      min: 0,
      max: 1,
    },
    URA: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 0, 1),
      min: 0,
      max: 1,
    },
    UAD: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 0, 1),
      min: 0,
      max: 1,
    },
    UPS: {
      type: Number,
      default: null,
      set: (v) => clamp(v, 0, 1),
      min: 0,
      max: 1,
    },
    initialTraits: {
      PRS: Number,
      CNT: Number,
      ANX: Number,
      VisitFreq: Number,
      AT: Number,
      PBC: Number,
      EMP: Number,
      TIN: Number,
      UES: Number,
      URA: Number,
      UAD: Number,
      UPS: Number,
    },
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
