const Agent = require("../models/Agent");
const { Script } = require("../models/Script");
const { Comment } = require("../models/Comment");

function analyzeNegativeActions(impactSummary, agents) {
  const fieldWeights = {
    bystander: {
      PRS: 0.33,
      CNT: 0.23,
      ANX: 0.16,
      VisitFreq: 0.07,
    },
    bully: {
      AT: 0.203,
      PBC: 0.44,
      EMP: 0.101,
      TIN: 0.144,
    },
  };

  const fieldSigns = {
    bystander: {
      PRS: -1,
      CNT: -1,
      ANX: 1,
      VisitFreq: -1,
    },
    bully: {
      AT: 1,
      PBC: 1,
      EMP: 1,
      TIN: 1,
    },
  };

  const agentRoles = Object.fromEntries(
    agents.map((a) => [a.username, a.role]),
  );

  const actionImpactMap = {}; // { actionId: totalHarmScore }

  for (const { actionId, agent, field, delta } of impactSummary.fieldChanges) {
    const role = agentRoles[agent];
    if (!role || !fieldWeights[role][field]) continue;

    const weight = fieldWeights[role][field];
    const sign = fieldSigns[role][field];

    const harm = delta * weight * sign;
    if (harm > 0) {
      actionImpactMap[actionId] = (actionImpactMap[actionId] || 0) + harm;
    }
  }

  // Convert to array and sort by harm descending
  return Object.entries(actionImpactMap)
    .sort(([, a], [, b]) => b - a)
    .map(([actionId, harm]) => ({ actionId, harm: +harm.toFixed(3) }));
}

async function getActionDetails(actionId, impactSummary, user) {
  const fieldChange = impactSummary.fieldChanges.find(
    (f) => f.actionId === actionId,
  );
  if (!fieldChange) return null;

  const { agent, field, delta } = fieldChange;

  const agentDoc = await Agent.findOne({ username: agent }).lean();
  const role = agentDoc?.role;
  const allActions = [
    ...(user.commentAction || []),
    ...(user.postAction || []),
    ...(user.otherAction || []),
  ];
  const action = allActions.find((a) => a._id.toString() === actionId);
  if (!action) return null;

  let type = "unknown",
    text = null,
    target = null;

  if (action.comment) {
    const comment = await Comment.findById(action.comment).populate(
      "commentor post",
    );
    type = "comment";
    text = action.text || comment?.text;
    target = {
      type: "post",
      id: comment?.post?._id.toString(),
      owner: comment?.post?.poster?.username,
    };
  } else if (action.post) {
    const post = await Script.findById(action.post).populate("poster");
    type = "post";
    text = action.text || post?.text;
    target = {
      type: "post",
      id: post?._id.toString(),
      owner: post?.poster?.username,
    };
  }

  const weightMap = {
    bystander: { PRS: 0.33, CNT: 0.23, ANX: 0.16, VisitFreq: 0.07 },
    bully: { AT: 0.203, PBC: 0.44, EMP: 0.101, TIN: 0.144 },
  };

  const signMap = {
    bystander: { PRS: -1, CNT: -1, ANX: 1, VisitFreq: -1 },
    bully: { AT: 1, PBC: 1, EMP: 1, TIN: 1 },
  };

  const weight = weightMap[role]?.[field] || 0;
  const sign = signMap[role]?.[field] || 0;
  const harmScore = +(delta * weight * sign).toFixed(3);

  return {
    actionId,
    type,
    text,
    target,
    affectedAgent: agent,
    role,
    fieldChanged: field,
    delta,
    harmScore,
    healthImpact: harmScore > 0 ? "negative" : "neutral/positive",
  };
}
