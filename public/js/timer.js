document.addEventListener("DOMContentLoaded", () => {
  const totalTime = 10;

  const wrapperDiv = document.createElement("div");
  wrapperDiv.style.position = "fixed";
  wrapperDiv.style.top = "140px";
  wrapperDiv.style.left = "125px";
  wrapperDiv.style.zIndex = "1000";

  const timerContainer = document.createElement("div");
  timerContainer.style.position = "relative";
  timerContainer.style.width = "300px";
  timerContainer.style.height = "20px";
  timerContainer.style.backgroundColor = "#0b2e0b";
  timerContainer.style.borderRadius = "10px";
  timerContainer.style.overflow = "hidden";
  timerContainer.style.padding = "4px";
  timerContainer.style.boxSizing = "border-box";

  const progressBar = document.createElement("div");
  progressBar.style.height = "100%";
  progressBar.style.width = "100%";
  progressBar.style.backgroundColor = "red";
  progressBar.style.borderRadius = "6px";
  progressBar.style.transition = "width 1s linear";

  const timeText = document.createElement("span");
  timeText.style.position = "absolute";
  timeText.style.right = "20px";
  timeText.style.top = "50%";
  timeText.style.transform = "translateY(-50%)";
  timeText.style.color = "white";
  timeText.style.fontSize = "20px";
  timeText.style.fontWeight = "bold";
  timeText.style.textShadow = "1px 1px 0 #0b2e0b, -1px -1px 0 #0b2e0b";
  timeText.textContent = "1:00";

  timerContainer.appendChild(progressBar);
  timerContainer.appendChild(timeText);
  wrapperDiv.appendChild(timerContainer);
  document.body.appendChild(wrapperDiv);

  function renderTimer(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timeText.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    const percent = (timeLeft / totalTime) * 100;
    progressBar.style.width = `${percent}%`;

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
    if (typeof allScores.timeLeft === "number") {
      renderTimer(allScores.timeLeft);
    }
  });

  window.resetTimer = function () {
    renderTimer(totalTime); // just draw full timer bar and text
  };
});

renderTimer(totalTime);
