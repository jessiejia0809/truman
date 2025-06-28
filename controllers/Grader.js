const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
const mongoose = require("mongoose");
const Agent = require("../models/Agent.js");

class Grader {
  constructor(solutionsPath) {
    this.solutions = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, solutionsPath), "utf-8"),
    );
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Call the LLM to classify actions against all solutions.
   *
   * @param {Array<Object>} actions
   * @returns {Promise<Array<{ actionId, category, affectedAgents }>>}
   */
  async classifyActionsWithLLM(actions) {
    const prompt = `
You are given two JSON inputs:
1) "actions": an array of user actions, each with {id, type, text, target, postId}.
2) "solutions": an array of rules, each with {category, keywords, deltas, agents}.

For each action, return all rules whose "category" applies.
Output strictly as JSON: [
  { "actionId": "...", "category": "...", "affectedAgents": ["..."] },
  ...
].
If no rules apply for any action, return the literal word None (no brackets).
    `.trim();

    const messages = [
      { role: "system", content: prompt },
      {
        role: "user",
        content: JSON.stringify({ actions, solutions: this.solutions }),
      },
    ];

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1000,
      temperature: 0,
    });

    let text = completion.choices[0].message.content.trim();
    console.log("LLM raw reply:", text);
    text = text
      .replace(/^```(?:json)?/, "")
      .replace(/```$/, "")
      .trim();
    if (/^none$/i.test(text)) {
      return [];
    }

    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Failed to parse LLM output:", err);
      return [];
    }
  }

  /**
   * Apply deltas for each classified match.
   *
   * @param {Array<{ actionId, category, affectedAgents }>} classified
   */
  async applyDeltas(classified) {
    for (const { category, affectedAgents } of classified) {
      const rule = this.solutions.find((r) => r.category === category);
      if (!rule) continue;

      for (const { field, value } of rule.deltas) {
        for (const agentId of affectedAgents) {
          // lookup agent by _id or username
          let ag = null;
          if (mongoose.Types.ObjectId.isValid(agentId)) {
            ag = await Agent.findById(agentId);
          }
          if (!ag) {
            ag = await Agent.findOne({ username: agentId });
          }
          if (!ag) {
            console.warn(`Grader: no Agent found for ${agentId}`);
            continue;
          }

          // compute raw new value
          const current = ag[field] ?? 0;
          const raw = current + value;

          // clamp per field domain
          if (["PRS", "CNT", "ANX", "VisitFreq"].includes(field)) {
            // bystander range 0–7
            ag[field] = Math.max(0, Math.min(7, raw));
          } else if (["AT", "PBC", "EMP", "TIN"].includes(field)) {
            // bully constants range 1–5
            ag[field] = Math.max(1, Math.min(5, raw));
          } else {
            ag[field] = raw;
          }

          await ag.save();
          console.log(
            `Grader: ${ag.username || ag._id}.${field} set to ${ag[field]}`,
          );
        }
      }
    }
  }
}

module.exports = Grader;
