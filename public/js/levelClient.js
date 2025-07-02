let currentLevel =
  parseInt(new URLSearchParams(window.location.search).get("level")) || 1;

export function getCurrentLevel() {
  return currentLevel;
}

export function goToNextLevel() {
  const nextLevel = currentLevel + 1;
  window.location.href = `/feed?level=${nextLevel}`;
}

window.retryLevel = function () {
  window.location.reload();
};

export function checkWinCondition(score, remainingTime) {
  const threshold = { 1: 90, 2: 120, 3: 150 }[currentLevel] || Infinity;
  if (score >= threshold) {
    showTransitionPopup("win");
  } else if (remainingTime <= 0) {
    showTransitionPopup("lose");
  }
}
