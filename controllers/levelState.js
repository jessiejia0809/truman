let levelStartTime = Date.now();
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

function getLevelStartTime() {
  return levelStartTime;
}

// 💡 Dynamic duration based on level
function getTotalDuration() {
  return currentLevel <= 3 ? 300 : 480; // 5 min for levels 1-3, 8 min for levels 4+
}

function getTimeLeft() {
  const elapsed = Math.floor((Date.now() - levelStartTime) / 1000);
  return Math.max(0, getTotalDuration() - elapsed);
}

module.exports = {
  getTimeLeft,
  getLevelStartTime,
  resetLevelStartTime,
  getLevel,
  setLevel,
  getTotalDuration,
};
