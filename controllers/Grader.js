const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
const mongoose = require("mongoose");
const Agent = require("../models/Agent.js");
const Objective = require("../models/Objective");
const Comment = require("../models/Comment");
const Chat = require("../models/Chat");
const User = require("../models/User");
const levelOrder = require(
  path.resolve(process.cwd(), "scenarios/level_order.json"),
);

class Grader {
  constructor({ level }) {
    const entry = levelOrder.find((e) => e.level === Number(level));
    const solutionsPath = path.resolve(
      process.cwd(),
      entry.folder,
      "solutions.json",
    );
    console.log(
      `Grader: loading solutions for level ${level} from:\n  ${solutionsPath}`,
    );

    this.solutions = JSON.parse(fs.readFileSync(solutionsPath, "utf-8"));
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  _extractMentions(text = "") {
    const out = [];
    const re = /@([A-Za-z0-9_.]+)/g;
    let m;
    while ((m = re.exec(text)) !== null) out.push(m[1]);
    return out;
  }

  /**
   * Decide if a chat_id is a 1:1 thread.
   */
  _isOneToOne(chat_id) {
    if (!chat_id) return false;
    // e.g. "its.kat-jessie2" => two parts
    return chat_id.split("-").length === 2;
  }

  /**
   * Build an action from a chat user message
   */
  _makeActionFromChatMessage(chatDoc, msg) {
    const chat_id = chatDoc.chat_id || "";
    const isOneToOne = this._isOneToOne(chat_id);
    const text = msg.body || "";

    return {
      id: msg._id,
      text,
      type: isOneToOne ? "direct_chat" : "chat",
      chat_id,
      postId: null,
      target: isOneToOne
        ? chat_id.split("-").find((name) => name !== msg.senderUsername)
        : null,
      mentioned: this._extractMentions(text),
      raw: msg,
    };
  }

  /**
   * Build an action from a user comment
   */
  _makeActionFromComment(doc) {
    // This schema you pasted: "commentType":"User"
    const text = doc.body || "";
    return {
      id: doc._id,
      text,
      type: "public_comment",
      chat_id: null,
      postId: doc.post || null,
      target: null,
      mentioned: this._extractMentions(text),
      raw: doc,
    };
  }

  /**
   * Preprocess raw DB updates into flat per-user “actions”.
   */
  preprocessActions(updates) {
    const actions = [];

    for (const u of updates) {
      // ---- Chats ----
      if (u.coll === "chats" && u.doc && Array.isArray(u.doc.messages)) {
        for (const msg of u.doc.messages) {
          if (msg.messageType === "User") {
            actions.push(this._makeActionFromChatMessage(u.doc, msg));
          }
        }
      }

      // ---- Comments ----
      if (u.coll === "comments" && u.doc) {
        const c = u.doc;
        if (c.commentType === "User") {
          actions.push(this._makeActionFromComment(c));
        }
      }

      // more; may or may not need
    }

    return actions;
  }

  /**
   * Optional heuristic to auto-match InvestigateInformer
   */
  _heuristicInvestigateInformer(actions) {
    const rule = this.solutions.find(
      (r) => r.category === "InvestigateInformer",
    );
    if (!rule) return [];

    const results = [];
    const rx = /(who|identity|leak|told|shared|disclos)/i;
    for (const a of actions) {
      if (
        a.type === "direct_chat" &&
        a.chat_id &&
        a.chat_id.includes("its.kat") &&
        rx.test(a.text)
      ) {
        // Verify agent involvement
        const affected = rule.agents.filter(
          (ag) =>
            (a.target && a.target === ag) ||
            a.mentioned.includes(ag) ||
            (a.chat_id && a.chat_id.includes(ag)),
        );
        if (affected.length) {
          results.push({
            actionId: a.id,
            category: "InvestigateInformer",
            affectedAgents: affected,
          });
        }
      }
    }
    return results;
  }

  /**
   * Call the LLM to classify actions against all solutions.
   *
   * @param {Array<Object>} rawUpdates
   * @returns {Promise<Array<{ actionId, category, affectedAgents }>>}
   */
  async classifyActionsWithLLM(rawUpdates) {
    const flatActions = this.preprocessActions(rawUpdates);

    const prompt = `
You are a semantic classifier.

INPUTS
1) "actions": array of user messages → { id, text, type, chat_id, postId, target, mentioned }
2) "solutions": array of categories → { category, description, deltas, agents }

TASK
For each action, assign the best-fitting category of solution based on meaning and context.

RULES
1. Match by description.
2. Context:
   • "InvestigateInformer" only applies to 1:1 chats.
   • All other categories are for public posts/comments.
3. only classify user actions! ANY AGENT ACTION DOES NOT COUNT. 

OUTPUT (strict JSON, no code fences):
[
  { "actionId": "...", "category": "...", "affectedAgents": ["..."] }
]

IF NOTHING MATCHES:
{
  "none": true,
  "reasons": [
    { "category": "InvestigateInformer", "reason": "..." },
    { "category": "PublicVictimSupport", "reason": "..." },
    ...
  ]
}
`.trim();

    const messages = [
      { role: "system", content: prompt },
      {
        role: "user",
        content: JSON.stringify({
          actions: flatActions,
          solutions: this.solutions,
        }),
      },
    ];

    console.log(
      "==== MESSAGES JSON ====\n" + JSON.stringify(messages, null, 2),
    );

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1000,
      temperature: 0,
      top_p: 0.1,
    });

    let text = (completion.choices?.[0]?.message?.content || "").trim();
    console.log("LLM raw reply:", text);
    text = text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    let llmMatches = [];
    try {
      const parsed = JSON.parse(text);
      if (parsed.none) {
        console.log("LLM returned none with reasons:", parsed.reasons);
      } else if (Array.isArray(parsed)) {
        llmMatches = parsed;
      } else {
        console.warn("Unexpected LLM shape, ignoring.");
      }
    } catch (err) {
      console.error("Failed to parse LLM output:", err);
      console.error("LLM output was:\n" + text);
    }

    // Optional: add heuristic InvestigateInformer matches if LLM missed them
    const heuristicMatches = this._heuristicInvestigateInformer(flatActions);
    // Merge (avoid duplicates)
    const key = ({ actionId, category }) => `${actionId}::${category}`;
    const seen = new Set(llmMatches.map((e) => key(e)));
    for (const h of heuristicMatches) {
      if (!seen.has(key(h))) {
        llmMatches.push(h);
        seen.add(key(h));
      }
    }

    await this._markCompletedObjectives(llmMatches, flatActions);
    return llmMatches;
  }

  /* ---------------- APPLY DELTAS ---------------- */

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

          const current = typeof ag[field] === "number" ? ag[field] : 0;
          const raw = current + value;

          let newValue;
          if (["PRS", "CNT", "ANX", "VisitFreq"].includes(field)) {
            newValue = Math.max(0, Math.min(7, raw));
          } else if (["AT", "PBC", "EMP", "TIN"].includes(field)) {
            newValue = Math.max(1, Math.min(5, Math.round(raw)));
          } else if (["UES", "URA", "UAD", "UPS"].includes(field)) {
            newValue = Math.max(0, Math.min(1, raw));
          } else {
            newValue = raw;
          }

          ag[field] = newValue;
          console.log(
            `Grader: ${ag.username || ag._id}.${field} += ${value} → ${newValue} (was ${current})`,
          );
          await ag.save();
        }
      }
    }
  }

  async _markCompletedObjectives(classified, flatActions) {
    for (const { actionId, category, affectedAgents } of classified) {
      let taskType = null;
      let recipientUsername = null;

      // Try resolving from the original flatActions list
      const originalAction = flatActions.find(
        (a) => a.id.toString() === actionId.toString(),
      );
      if (originalAction) {
        const messageType = originalAction.raw?.messageType;
        const commentType = originalAction.raw?.commentType;

        if (messageType === "User" || commentType === "User") {
          taskType =
            originalAction.type === "public_comment" ? "comment" : "dm";
          recipientUsername = originalAction.target; // assuming .target holds recipient username
          console.log(
            `🧩 Resolved as taskType=${taskType}, recipient=${recipientUsername}`,
          );
        } else {
          console.log(
            `⚠️ Skipped non-user message/comment type for action ${actionId}`,
          );
        }
      }

      if (!taskType) {
        console.log(`❌ Could not resolve taskType for action ${actionId}`);
        continue;
      }

      console.log(
        `🔍 Looking for objectives: category=${category}, type=${taskType}`,
      );

      const objectives = await Objective.find({
        goalCategory: category,
        taskType,
        completed: false,
      });

      console.log(`📎 Matched ${objectives.length} objectives`);

      for (const obj of objectives) {
        const agentMatch = affectedAgents.some(
          (agent) =>
            agent === obj.targetAgent?.toString() ||
            agent === obj.targetAgentUsername ||
            agent
              .toLowerCase()
              .includes(obj.targetAgentUsername?.toLowerCase()),
        );

        const directMatch =
          recipientUsername && obj.targetAgentUsername === recipientUsername;

        if (agentMatch || directMatch) {
          obj.completed = true;
          obj.completedAt = new Date();
          await obj.save();
          console.log(
            `✅ Objective complete on ${category} for ${obj.targetAgentUsername}`,
          );
        }
      }
    }
  }
}

module.exports = Grader;
