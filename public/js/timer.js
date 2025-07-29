document.addEventListener("DOMContentLoaded", () => {
  const totalTime = 20;

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
  Object.assign(timerWrapper.style, {
    position: "fixed",
    top: "215px",
    left: "150px",
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    background:
      "radial-gradient(ellipse at center, rgba(0, 0, 100, 0.5), #000)",
    boxShadow: "0 0 10px 4px rgba(0,0,255,0.3)",
    zIndex: "1000",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transition: "box-shadow 0.4s ease",
  });

  // Aura layer with subtle glow
  const aura = document.createElement("div");
  aura.className = "timer-aura";
  Object.assign(aura.style, {
    position: "absolute",
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    boxShadow: "0 0 20px 10px rgba(0,0,255,0.05)",
    animation: "auraPulse 2s ease-in-out infinite",
    pointerEvents: "none",
  });

  // Time display
  const timeText = document.createElement("div");
  timeText.className = "timer-text";
  Object.assign(timeText.style, {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#3fa9f5",
    textShadow: "1px 1px 3px #000",
  });
  timeText.textContent = "1:00";

  // Add all parts to DOM
  timerWrapper.appendChild(aura);
  timerWrapper.appendChild(timeText);
  document.body.appendChild(timerWrapper);

  function renderTimer(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timeText.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    // Compute dynamic intensity based on time remaining
    const intensity = Math.min(Math.pow(timeLeft / totalTime, 2), 0.9);
    const baseSize = 10 + intensity * 20;

    const auraGlow = `0 0 ${baseSize}px ${baseSize / 2}px rgba(30, 30, 255, ${0.2 + intensity * 0.3})`;

    aura.style.boxShadow = auraGlow;
    timerWrapper.style.boxShadow = `
      0 0 ${8 + intensity * 20}px ${intensity * 8}px rgba(0, 0, 255, ${0.2 + intensity * 0.4}),
      inset 0 0 ${4 + intensity * 15}px rgba(0, 0, 255, ${0.1 + intensity * 0.3})
    `;

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
