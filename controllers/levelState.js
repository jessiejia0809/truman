let levelStartTime = Date.now();
const TOTAL_DURATION = 300; // or 10 if testing
let currentLevel = 1;

function setLevel(level) {
  currentLevel = level;
}

function getLevel() {
  return currentLevel;
}

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
  getLevel,
  setLevel,
  getTimeLeft,
};
