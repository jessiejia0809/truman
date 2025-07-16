window.socket = window.socket || io("http://localhost:3000");

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
  const currentLevel =
    parseInt(new URLSearchParams(window.location.search).get("level")) || 1;

  window.socket.emit("resetLevel", { level: currentLevel });
  console.log("🔄 Level reset requested via socket.");

  // Wait and reload the same level
  setTimeout(() => {
    window.location.href = `/feed?level=${currentLevel}`;
  }, 300);
};

window.checkWinCondition = async function (score, remainingTime, userActions) {
  console.log("Checking win condition for level", currentLevel);
  if (currentLevel == 1 && score >= 80) {
    console.log("Level 1 complete!");
    window.freezeScore();
    window.showTransitionPopup("win");
  } else if (score >= 80) {
    console.log("Level complete!");
    window.freezeScore();
    window.showTransitionPopup("win");
  } else if (remainingTime <= 0) {
    window.freezeScore();
    console.log("Time's up! Checking for win condition.");
    if (!userActions) {
      console.warn("No userActions provided for feedback analysis.");
      window.showTransitionPopup("lose", [], score);
      return;
    }
    console.log("Fetching feedback for user actions");
    const feedback = await window.fetchFeedback(userActions);
    console.log("Feedback received:", feedback);
    window.showTransitionPopup("lose", feedback, score);
  }
};

window.fetchFeedback = async function (userActions) {
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: userActions }),
    });

    if (!res.ok) throw new Error("Failed to fetch feedback");

    const { feedback } = await res.json();
    return feedback;
  } catch (err) {
    console.error("Feedback error:", err);
    return [];
  }
};
