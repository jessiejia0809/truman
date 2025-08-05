require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
const ScoreController = require("./ScoreController");
const { performFeedAction } = require("./script");
const Agent = require("../models/Agent");
const Session = require("../models/Session");
const Script = require("../models/Script");

const levelOrder = require(
  path.resolve(process.cwd(), "scenarios/level_order.json"),
);

/**
 * Helper to push a comment via your existing /action endpoint
 */
async function pushComment({ postId, text, author, sessionName, level }) {
  const session = await Session.findOne({ name: sessionName }).exec();
  const body = {
    action: "comment",
    postID: postId,
    new_comment: new Date().toISOString(),
    comment_text: text,
    sessionName,
    currentLevel: level,
  };
  const { comment } = await performFeedAction(author, true, body, session);

  if (!comment?._id) {
    throw new Error(`pushComment failed for level ${level}`);
  }

  return comment._id.toString();
}

/**
 * Overwrite the `body` field on your “script” document
 */
async function modifyPost({ postId, newBody }) {
  const updated = await Script.findByIdAndUpdate(
    postId,
    {
      $set: {
        body: newBody,
        updateTime: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updated) {
    throw new Error(`modifyPost: post ${postId} not found`);
  }

  console.log(`[Grader] modifyPost OK – new body is:\n${updated.body}`);
  return updated._id.toString();
}

class Grader {
  constructor({ level, scoreController }) {
    this.level = Number(level);
    this.scoreController = scoreController;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const entry = levelOrder.find((e) => e.level === this.level);
    const solutionsPath = path.join(
      process.cwd(),
      entry.folder,
      "solutions.json",
    );
    console.log(`Loading solutions for level ${this.level}: ${solutionsPath}`);
    this.solutions = JSON.parse(fs.readFileSync(solutionsPath, "utf-8"));
  }

  _extractMentions(text = "") {
    return [...text.matchAll(/@([A-Za-z0-9_.]+)/g)].map((m) => m[1]);
  }

  _isOneToOne(chatId = "") {
    return chatId.split("-").length === 2;
  }

  _makeActionFromChat(chatDoc, msg) {
    const chatId = chatDoc.chat_id || "";
    const direct = this._isOneToOne(chatId);
    return {
      id: msg._id,
      text: msg.body || "",
      type: direct ? "direct_chat" : "chat",
      chatId,
      postId: null,
      target: direct
        ? chatId.split("-").find((name) => name !== msg.senderUsername)
        : null,
      mentioned: this._extractMentions(msg.body),
    };
  }

  _makeActionFromComment(doc) {
    return {
      id: doc._id,
      text: doc.body || "",
      type: "public_comment",
      chatId: null,
      postId: doc.post || null,
      target: null,
      mentioned: this._extractMentions(doc.body),
    };
  }

  preprocessActions(updates) {
    const actions = [];
    for (const u of updates) {
      if (u.coll === "chats" && u.doc?.messages) {
        for (const msg of u.doc.messages) {
          if (msg.messageType === "User") {
            actions.push(this._makeActionFromChat(u.doc, msg));
          }
        }
      }
      if (u.coll === "comments" && u.doc?.commentType === "User") {
        actions.push(this._makeActionFromComment(u.doc));
      }
    }
    return actions;
  }

  /**
   * You are a semantic classifier.

     INPUT:
     - "actions": array of objects { text, type, mentioned }
     - "categories": array of category names and descriptions

     TASK:
     For each action in the "actions" list, pick one category from the provided list that best matches the action's intent/context (public_comment vs chat). If none fit, pick "none".

     OUTPUT:
     Return a JSON array of strings, same length as "actions", where each element is the chosen category name or "none".

     Do NOT include any extra text.
   */
  async classifyActionsWithLLM(rawUpdates) {
    const actions = this.preprocessActions(rawUpdates);
    this.lastActions = actions; // stash for nextSteps
    const cats = this.solutions.map((s) => s.category);

    if (!actions.length || !cats.length) {
      return actions.map(() => "none");
    }

    const promptSystem = `
You are a semantic classifier.

INPUT:
- "actions": array of { text, type, mentioned }
- "solutions": array of { category, description, deltas, next_steps }

TASK:
Treat the entire actions list as one unit. For each solution:
  • If any action aligns with that solution, include its category in "matchedSolutions".  
  • Otherwise, in "unmatchedReasons", map that category to a brief reason why none of the actions fit.
There is for most times only one solution corresponding to each action. 

OUTPUT FORMAT:
Return exactly one JSON object with two properties:
{
  "matchedSolutions": ["CategoryA"],
  "unmatchedReasons": {
    "CategoryB": "reason for B",
    "CategoryC": "reason for C",
    …
  }
}
Do not emit any other text.
`.trim();

    const payload = {
      actions: actions.map((a) => ({
        text: a.text.slice(0, 800),
        type: a.type,
        mentioned: a.mentioned,
      })),
      categories: this.solutions.map((s) => ({
        name: s.category,
        description: s.description,
      })),
    };

    const resp = await this.openai.chat.completions.create({
      model: process.env.OPENAI_API_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: promptSystem.trim() },
        { role: "user", content: JSON.stringify(payload) },
      ],
      temperature: 0,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const rawContent = resp.choices?.[0]?.message?.content ?? "";
    console.log("💡 LLM raw content:", rawContent);

    let result;
    try {
      result = JSON.parse(resp.choices[0].message.content.trim());
    } catch (e) {
      console.error("Failed to parse grouping output:", e);
      // fallback: nothing matched
      result = {
        matchedSolutions: [],
        unmatchedReasons: {},
      };
    }

    // **NEW** — strip away everything else and return only the matched solutions array:
    return result.matchedSolutions;
  }

  /**
   * @param {string[]} categories
   * @returns {Promise<number>} updated health score for this level
   */
  async applyDeltas(categories) {
    const current = await this.scoreController.getHealthScore(this.level);
    const totalDelta = categories.reduce((sum, cat) => {
      if (cat === "none") return sum;
      const sol = this.solutions.find((s) => s.category === cat);
      return sol ? sum + (sol.deltas ?? sol.delta ?? 0) : sum;
    }, 0);
    const updated = current + totalDelta;
    await this.scoreController.setHealthScore(this.level, updated);
    return updated;
  }

  /**
   * Execute next_steps for each action/category.
   * @param {string[]} categories  – Array of category names, same length as lastActions
   */
  async processNextSteps(categories) {
    // load session once
    const session = await Session.findOne({
      name: process.env.SESSION_NAME,
    }).exec();
    if (!session)
      throw new Error(`Session "${process.env.SESSION_NAME}" not found`);

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      if (cat === "none") continue;

      const sol = this.solutions.find((s) => s.category === cat);
      if (!sol || !sol.next_steps || !sol.next_steps.length) continue;

      // log scenario type (comment or modify_post)
      const stepType = sol.next_steps[0].type;
      console.log(`[Grader] Scenario "${sol.category}" -> ${stepType}`);

      // find the relevant post once per scenario
      const post = await Script.findOne({
        level: this.level,
        isRelevant: true,
      }).exec();
      if (!post) break;
      console.log(`[Grader] Target post ID: ${post._id}`);

      for (const step of sol.next_steps) {
        if (step.type === "comment") {
          const actor = await Agent.findOne({ username: step.agent }).exec();
          if (!actor) break;

          console.log(
            `[Grader] Posting comment by ${actor.username} (${actor._id}) on post ${post._id}: "${step.content}"`,
          );
          const commentId = await pushComment({
            postId: post._id.toString(),
            text: step.content,
            author: actor._id.toString(),
            sessionName: process.env.SESSION_NAME,
            level: this.level,
          });
          console.log(`[Grader] Comment posted with ID ${commentId}`);
        } else if (step.type === "modify post") {
          console.log(
            `[Grader] Modifying post ${post._id} with new body: "${step.content}"`,
          );
          const modifiedId = await modifyPost({
            postId: post._id.toString(),
            newBody: step.content,
          });
          console.log(`[Grader] Post modified with ID ${modifiedId}`);
        }
      }
    }
  }
}

module.exports = Grader;

// /* ---------------- APPLY DELTAS ---------------- */

// /**
//  * Apply deltas for each classified match.
//  *
//  * @param {Array<{ actionId, category, affectedAgents }>} classified
//  */
// async applyDeltas(classified) {
//   for (const { category, affectedAgents } of classified) {
//     const rule = this.solutions.find((r) => r.category === category);
//     if (!rule) continue;

//     for (const { field, value } of rule.deltas) {
//       for (const agentId of affectedAgents) {
//         let ag = null;
//         if (mongoose.Types.ObjectId.isValid(agentId)) {
//           ag = await Agent.findById(agentId);
//         }
//         if (!ag) {
//           ag = await Agent.findOne({ username: agentId });
//         }
//         if (!ag) {
//           console.warn(`Grader: no Agent found for ${agentId}`);
//           continue;
//         }

//         const current = typeof ag[field] === "number" ? ag[field] : 0;
//         const raw = current + value;

//         let newValue;
//         if (["PRS", "CNT", "ANX", "VisitFreq"].includes(field)) {
//           newValue = Math.max(0, Math.min(7, raw));
//         } else if (["AT", "PBC", "EMP", "TIN"].includes(field)) {
//           newValue = Math.max(1, Math.min(5, Math.round(raw)));
//         } else if (["UES", "URA", "UAD", "UPS"].includes(field)) {
//           newValue = Math.max(0, Math.min(1, raw));
//         } else {
//           newValue = raw;
//         }

//         ag[field] = newValue;
//         console.log(
//           `Grader: ${ag.username || ag._id}.${field} += ${value} → ${newValue} (was ${current})`,
//         );
//         await ag.save();
//       }
//     }
//   }
// }

//   async _markCompletedObjectives(classified, flatActions) {
//     for (const { actionId, category, affectedAgents } of classified) {
//       let taskType = null;
//       let recipientUsername = null;

//       // Try resolving from the original flatActions list
//       const originalAction = flatActions.find(
//         (a) => a.id.toString() === actionId.toString(),
//       );
//       if (originalAction) {
//         const messageType = originalAction.raw?.messageType;
//         const commentType = originalAction.raw?.commentType;

//         if (messageType === "User" || commentType === "User") {
//           taskType =
//             originalAction.type === "public_comment" ? "comment" : "dm";
//           recipientUsername = originalAction.target; // assuming .target holds recipient username
//           console.log(
//             `🧩 Resolved as taskType=${taskType}, recipient=${recipientUsername}`,
//           );
//         } else {
//           console.log(
//             `⚠️ Skipped non-user message/comment type for action ${actionId}`,
//           );
//         }
//       }

//       if (!taskType) {
//         console.log(`❌ Could not resolve taskType for action ${actionId}`);
//         continue;
//       }

//       console.log(
//         `🔍 Looking for objectives: category=${category}, type=${taskType}`,
//       );

//       const objectives = await Objective.find({
//         goalCategory: category,
//         taskType,
//         completed: false,
//       });

//       console.log(`📎 Matched ${objectives.length} objectives`);

//       for (const obj of objectives) {
//         const agentMatch = affectedAgents.some(
//           (agent) =>
//             agent === obj.targetAgent?.toString() ||
//             agent === obj.targetAgentUsername ||
//             agent
//               .toLowerCase()
//               .includes(obj.targetAgentUsername?.toLowerCase()),
//         );

//         const directMatch =
//           recipientUsername && obj.targetAgentUsername === recipientUsername;

//         if (agentMatch || directMatch) {
//           obj.completed = true;
//           obj.completedAt = new Date();
//           await obj.save();
//           console.log(
//             `✅ Objective complete on ${category} for ${obj.targetAgentUsername}`,
//           );
//         }
//       }
//     }
//   }
// }

// module.exports = Grader;
