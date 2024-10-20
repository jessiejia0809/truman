const mongoose = require('mongoose');
const { actorSchema } = require('./Actor')

const agentSchema = new mongoose.Schema({
  // Extend the actor schema
  ...actorSchema.obj,
}, { timestamps: true, versionKey: false });

const Agent = mongoose.model('Agent', agentSchema);
module.exports = Agent;