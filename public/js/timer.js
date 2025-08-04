document.addEventListener("DOMContentLoaded", () => {
  const totalTime = 60;

  const timerBarContainer = document.createElement("div");
  timerBarContainer.style.position = "fixed";
  timerBarContainer.style.bottom = "120px";
  timerBarContainer.style.left = "40px";
  timerBarContainer.style.width = "260px";
  timerBarContainer.style.height = "14px";
  timerBarContainer.style.backgroundColor = "#333";
  timerBarContainer.style.borderRadius = "7px";
  timerBarContainer.style.overflow = "hidden";
  timerBarContainer.style.zIndex = "1000";

  const timerFill = document.createElement("div");
  timerFill.style.height = "100%";
  timerFill.style.width = "100%";
  timerFill.style.backgroundColor = "#3fa9f5";
  timerFill.style.transition = "width 1s linear";

  timerBarContainer.appendChild(timerFill);
  document.body.appendChild(timerBarContainer);

  function renderTimer(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    const percent = Math.max(0, Math.min(1, timeLeft / totalTime));
    timerFill.style.width = `${percent * 100}%`;

    // Optional game-specific condition hook
    if (typeof window.checkWinCondition === "function") {
      window.checkWinCondition(
        window.currentScore || 0,
        timeLeft,
        window.userActions || [],
      );
    }
  }

  // Socket setup
  const socket = window.socket || io("http://localhost:3000");
  window.socket = socket;

  // Listen for server updates
  socket.on("scoreUpdate", (allScores) => {
    if (typeof allScores.timeLeft === "number") {
      renderTimer(allScores.timeLeft);
    }
  });

  // Expose global timer reset
  window.resetTimer = function () {
    renderTimer(totalTime);
  };
});
