document.addEventListener("DOMContentLoaded", () => {
  let timeLeft = 60;
  const totalTime = timeLeft;

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

  function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timeText.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    const percent = (timeLeft / totalTime) * 100;
    progressBar.style.width = `${percent}%`;

    if (timeLeft <= 0) {
      timeLeft = 0;
      clearInterval(timerInterval);
      showTransitionPopup();
    }

    timeLeft--;
  }

  const timerInterval = setInterval(updateTimer, 1000);
  updateTimer();

  window.resetTimer = function () {
    timeLeft = totalTime;
    clearInterval(timerInterval);
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  };
});

function showTransitionPopup(result = "lose") {
  const file = result === "win" ? "/win_screen.json" : "/lose_screen.json";

  fetch(file)
    .then((res) => res.json())
    .then((json) => {
      const root = json.contents.children;

      const modalOverlay = document.createElement("div");
      modalOverlay.style.position = "fixed";
      modalOverlay.style.top = 0;
      modalOverlay.style.left = 0;
      modalOverlay.style.width = "100vw";
      modalOverlay.style.height = "100vh";
      modalOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
      modalOverlay.style.zIndex = 9999;
      modalOverlay.style.display = "flex";
      modalOverlay.style.alignItems = "center";
      modalOverlay.style.justifyContent = "center";

      const modalBox = document.createElement("div");
      modalBox.style.backgroundColor = "#720000";
      modalBox.style.border = "5px solid #ab0909";
      modalBox.style.color = "white";
      modalBox.style.width = "400px";
      modalBox.style.padding = "30px";
      modalBox.style.borderRadius = "10px";
      modalBox.style.textAlign = "center";

      const label = Object.values(root).find((el) => el.type === "Label");
      if (label) {
        const h1 = document.createElement("h1");
        h1.innerText = label.data.text || "Session Over";
        modalBox.appendChild(h1);
      }

      const button = document.createElement("button");
      button.innerText = "Retry";
      button.style.marginTop = "20px";
      button.style.padding = "10px 20px";
      button.style.fontSize = "16px";
      button.style.cursor = "pointer";
      button.onclick = () => {
        modalOverlay.remove();
        if (typeof window.resetTimer === "function") resetTimer();
        if (typeof window.resetScore === "function") resetScore();
      };

      modalBox.appendChild(button);
      modalOverlay.appendChild(modalBox);
      document.body.appendChild(modalOverlay);
    });

  window.showTransitionPopup = showTransitionPopup;
}
