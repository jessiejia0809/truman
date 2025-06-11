document.addEventListener("DOMContentLoaded", () => {
  let timeLeft = 60;

  const timerDisplay = document.createElement("div");
  timerDisplay.id = "countdown-timer";

  timerDisplay.style.position = "fixed";
  timerDisplay.style.top = "20px";
  timerDisplay.style.right = "20px";
  timerDisplay.style.padding = "10px 20px";
  timerDisplay.style.background = "rgba(0,0,0,0.7)";
  timerDisplay.style.color = "white";
  timerDisplay.style.fontSize = "20px";
  timerDisplay.style.borderRadius = "5px";
  timerDisplay.style.zIndex = "1000";

  document.body.appendChild(timerDisplay);

  function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      showTransitionPopup();
    }

    timeLeft--;
  }

  const timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
});

function showTransitionPopup(result = "lose") {
  const file =
    result === "win"
      ? "/public/data/win_screen.json"
      : "/public/data/lose_screen.json";

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
      button.onclick = () => modalOverlay.remove();

      modalBox.appendChild(button);
      modalOverlay.appendChild(modalBox);
      document.body.appendChild(modalOverlay);
    });
}
