let levelStartTime = Date.now();
const TOTAL_DURATION = 60; // or 10 if testing

function resetLevelStartTime() {
  levelStartTime = Date.now();
}

function getTimeLeft() {
  const elapsed = Math.floor((Date.now() - levelStartTime) / 1000);
  return Math.max(0, TOTAL_DURATION - elapsed);
}

function getLevelStartTime() {
  return levelStartTime;
}

module.exports = {
  TOTAL_DURATION,
  getTimeLeft,
  getLevelStartTime,
  resetLevelStartTime,
};
