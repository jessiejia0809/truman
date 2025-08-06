document.addEventListener("DOMContentLoaded", () => {
  const totalTime = 480;

  // Create the outer container
  const timerBarContainer = document.createElement("div");
  timerBarContainer.style.position = "fixed";
  timerBarContainer.style.bottom = "50px";
  timerBarContainer.style.left = "40px";
  timerBarContainer.style.width = "300px";
  timerBarContainer.style.height = "24px";
  timerBarContainer.style.backgroundColor = "#555";
  timerBarContainer.style.border = "1px solid #999";
  timerBarContainer.style.borderRadius = "4px";
  timerBarContainer.style.overflow = "hidden";
  timerBarContainer.style.zIndex = "1000";
  timerBarContainer.style.display = "flex";
  timerBarContainer.style.alignItems = "center";
  timerBarContainer.style.justifyContent = "flex-start";
  timerBarContainer.style.fontFamily = "monospace";
  timerBarContainer.style.fontSize = "0.9rem";
  timerBarContainer.style.color = "#fff";

  // Create the fill portion
  const timerFill = document.createElement("div");
  timerFill.style.height = "100%";
  timerFill.style.backgroundColor = "#ccc";
  timerFill.style.transition = "width 1s linear";
  timerFill.style.flexGrow = "0";

  // Create the text element inside the bar
  const timerText = document.createElement("div");
  timerText.style.position = "absolute";
  timerText.style.left = "12px";
  timerText.style.color = "#000";
  timerText.style.fontWeight = "bold";
  timerText.textContent = "08:00";

  // Add all to DOM
  timerBarContainer.appendChild(timerFill);
  timerBarContainer.appendChild(timerText);
  document.body.appendChild(timerBarContainer);

  function renderTimer(timeLeft, totalTime) {
    const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const seconds = String(timeLeft % 60).padStart(2, "0");
    timerText.textContent = `${minutes}:${seconds}`;

    const percent = Math.max(0, Math.min(1, timeLeft / totalTime));
    timerFill.style.width = `${percent * 100}%`;
    console.log(
      "Checking if win condition function exists:",
      typeof window.checkWinCondition === "function",
    );
    if (typeof window.checkWinCondition === "function") {
      console.log(
        "Checking win condition with score:",
        window.currentScore || 0,
        "and time left:",
        timeLeft,
      );
      window.checkWinCondition(window.currentScore || 0, timeLeft);
    }
  }

  const socket = window.socket || io("http://localhost:3000");
  window.socket = socket;

  let isTimerFrozen = false;

  window.freezeTimer = function () {
    isTimerFrozen = true;
  };

  window.unfreezeTimer = function () {
    isTimerFrozen = false;
  };

  socket.on("scoreUpdate", (allScores) => {
    if (isTimerFrozen) return;

    if (
      typeof allScores.timeLeft === "number" &&
      typeof allScores.totalTime === "number"
    ) {
      renderTimer(allScores.timeLeft, allScores.totalTime);
    }
  });

  window.resetTimer = function () {
    renderTimer(totalTime);
  };
});
