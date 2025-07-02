const ScoreController = require("./score");
const TimerController = require("./timer");

const LEVEL_THRESHOLDS = { 1: 90, 2: 120, 3: 150 };
const MAX_TIME_MS = 3 * 60 * 1000;

exports.evaluateLevel = async (sessionId, level, io) => {
  try {
    const score = await ScoreController.getCurrentScore(sessionId);
    const elapsed = await TimerController.getElapsedTime(sessionId);
    const threshold = LEVEL_THRESHOLDS[level] || Infinity;

    if (elapsed >= MAX_TIME_MS) {
      const outcome = score >= threshold ? "win" : "lose";
      io.emit("levelResult", { outcome, level });
    }
  } catch (err) {
    console.error("Level evaluation failed:", err);
  }
};
