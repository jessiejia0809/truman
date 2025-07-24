document.addEventListener("DOMContentLoaded", () => {
  const totalTime = 60;

  // Inject pulse animation style if not already added
  if (!document.getElementById("aura-animation-style")) {
    const style = document.createElement("style");
    style.id = "aura-animation-style";
    style.textContent = `
      @keyframes auraPulse {
        0%   { box-shadow: 0 0 10px rgba(0,0,255,0.2); }
        50%  { box-shadow: 0 0 20px rgba(0,0,255,0.4); }
        100% { box-shadow: 0 0 10px rgba(0,0,255,0.2); }
      }
    `;
    document.head.appendChild(style);
  }

  // Timer circular wrapper
  const timerWrapper = document.createElement("div");
  timerWrapper.className = "guardian-timer-wrapper";
  timerWrapper.style.position = "fixed";
  timerWrapper.style.top = "215px";
  timerWrapper.style.left = "150px";
  timerWrapper.style.width = "100px";
  timerWrapper.style.height = "100px";
  timerWrapper.style.borderRadius = "50%";
  timerWrapper.style.background =
    "radial-gradient(ellipse at center, rgba(0, 0, 100, 0.5), #000)";
  timerWrapper.style.boxShadow = "0 0 10px 4px rgba(0,0,255,0.3)";
  timerWrapper.style.zIndex = "1000";
  timerWrapper.style.display = "flex";
  timerWrapper.style.justifyContent = "center";
  timerWrapper.style.alignItems = "center";
  timerWrapper.style.transition = "box-shadow 0.4s ease";

  // Aura layer with subtle glow
  const aura = document.createElement("div");
  aura.className = "timer-aura";
  aura.style.position = "absolute";
  aura.style.width = "100px";
  aura.style.height = "100px";
  aura.style.borderRadius = "50%";
  aura.style.boxShadow = "0 0 20px 10px rgba(0,0,255,0.2)";
  aura.style.animation = "auraPulse 2s ease-in-out infinite";
  aura.style.pointerEvents = "none";

  // Time display
  const timeText = document.createElement("div");
  timeText.className = "timer-text";
  timeText.style.fontSize = "20px";
  timeText.style.fontWeight = "bold";
  timeText.style.color = "#3fa9f5";
  timeText.style.textShadow = "1px 1px 3px #000";
  timeText.textContent = "1:00";

  timerWrapper.appendChild(aura);
  timerWrapper.appendChild(timeText);
  document.body.appendChild(timerWrapper);

  function renderTimer(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timeText.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    // Optional dynamic intensity (scaled down)
    const intensity = timeLeft / totalTime;
    const baseSize = 10 + intensity * 20;

    const auraGlow = `0 0 ${baseSize}px ${baseSize / 2}px rgba(30, 30, 255, ${
      0.2 + intensity * 0.3
    })`;

    aura.style.boxShadow = auraGlow;
    timerWrapper.style.boxShadow = `
      0 0 ${8 + intensity * 20}px ${intensity * 8}px rgba(0, 0, 255, ${
        0.2 + intensity * 0.4
      }),
      inset 0 0 ${4 + intensity * 15}px rgba(0, 0, 255, ${
        0.1 + intensity * 0.3
      })`;

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
    renderTimer(totalTime);
  };
});
