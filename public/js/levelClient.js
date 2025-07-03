let currentLevel =
  parseInt(new URLSearchParams(window.location.search).get("level")) || 1;

window.getCurrentLevel = function () {
  return currentLevel;
};

window.goToNextLevel = function () {
  const nextLevel = currentLevel + 1;
  window.location.href = `/feed?level=${nextLevel}`;
};

window.retryLevel = function () {
  window.location.reload();
};

window.checkWinCondition = function (score, remainingTime) {
  console.log("Checking win condition for level", currentLevel);
  if (currentLevel == 1 && score >= 50) {
    console.log("Level 1 complete!");
    window.showTransitionPopup("win");
  } else if (currentLevel == 2 && score >= 90) {
    console.log("Level 2 complete!");
    window.showTransitionPopup("win");
  } else if (remainingTime <= 0) {
    window.showTransitionPopup("lose");
  }
};
