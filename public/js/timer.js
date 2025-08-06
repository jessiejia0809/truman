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

    if (typeof window.checkWinCondition === "function") {
      window.checkWinCondition(
        window.currentScore || 0,
        timeLeft,
        window.userActions || [],
      );
    }
  }

  const socket = window.socket || io("http://localhost:3000");
  window.socket = socket;

  socket.on("scoreUpdate", (allScores) => {
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

/*document.addEventListener("DOMContentLoaded", () => {
  const totalTime = 480;

  const timerBarContainer = document.createElement("div");
  timerBarContainer.style.position = "fixed";
  timerBarContainer.style.bottom = "50px";
  timerBarContainer.style.left = "40px";
  timerBarContainer.style.width = "300px";
  timerBarContainer.style.height = "12px";
  timerBarContainer.style.backgroundColor = "#333";
  timerBarContainer.style.borderRadius = "7px";
  timerBarContainer.style.overflow = "hidden";
  timerBarContainer.style.zIndex = "1000";

  const timerFill = document.createElement("div");
  timerFill.style.height = "100%";
  timerFill.style.width = "100%";
  timerFill.style.backgroundColor = "#ffffff";
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
});*/
