const LEVEL_THRESHOLDS = 90;
const MAX_TIME_MS = 3 * 60 * 1000;

window.evaluateLevel = async (sessionId, level, io) => {
  try {
    const score = window.currentScore || 0;
    const elapsed = 10 - window.timeLeft || 0; // Assuming timeLeft is in seconds
    const threshold = LEVEL_THRESHOLDS;

    if (elapsed >= MAX_TIME_MS) {
      const outcome = score >= threshold ? "win" : "lose";
      io.emit("levelResult", { outcome, level });
    }
  } catch (err) {
    console.error("Level evaluation failed:", err);
  }
};
