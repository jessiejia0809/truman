// controllers/LevelController.js

const ScoreController = require("./score");
const TimerController = require("./timer");

const LEVEL_THRESHOLDS = 90;

const MAX_TIME_MS = 3 * 60 * 1000;

exports.evaluateLevel = async (sessionId, level, io) => {
  try {
    const score = await ScoreController.getCurrentScore(sessionId);
    const elapsed = await TimerController.getElapsedTime(sessionId);

    const threshold = LEVEL_THRESHOLDS[level] || Infinity;

    if (elapsed >= MAX_TIME_MS) {
      if (score >= threshold) {
        io.emit("levelResult", { outcome: "win", level });
      } else {
        io.emit("levelResult", { outcome: "lose", level });
      }
    }
  } catch (err) {
    console.error("Level evaluation failed:", err);
  }
};

export function getCurrentLevel() {
  const url = new URL(window.location.href);
  return parseInt(url.searchParams.get("level") || "1", 10);
}

window.goToNextLevel = function () {
  const nextLevel = getCurrentLevel() + 1;
  const url = new URL(window.location.href);
  url.searchParams.set("level", nextLevel);
  window.location.href = url.toString();
};

window.retryLevel = function () {
  window.location.reload();
};
