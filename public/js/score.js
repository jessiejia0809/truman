document.addEventListener("DOMContentLoaded", () => {
  // Inject keyframe animation once
  if (!document.getElementById("liquid-animation-style")) {
    const style = document.createElement("style");
    style.id = "liquid-animation-style";
    style.textContent = `
      @keyframes liquidWave {
        0% { background-position: 0 0; }
        100% { background-position: 40px 40px; }
      }
    `;
    document.head.appendChild(style);
  }

  window.currentScore = parseInt(sessionStorage.getItem("currentScore")) || 0;

  // Create score bar container
  const scoreWrapper = document.createElement("div");
  scoreWrapper.className = "score-wrapper";
  scoreWrapper.style.position = "fixed";
  scoreWrapper.style.top = "100px";
  scoreWrapper.style.left = "130px";
  scoreWrapper.style.width = "300px";
  scoreWrapper.style.height = "30px";
  scoreWrapper.style.backgroundColor = "#222";
  scoreWrapper.style.borderRadius = "10px";
  scoreWrapper.style.overflow = "hidden";
  scoreWrapper.style.zIndex = "1000";

  // Create score bar fill
  const scoreBar = document.createElement("div");
  scoreBar.className = "score-bar";
  scoreBar.style.height = "100%";
  scoreBar.style.width = "0%";
  scoreBar.style.position = "absolute";
  scoreBar.style.top = "0";
  scoreBar.style.left = "0";
  scoreBar.style.borderRadius = "10px";
  scoreBar.style.transition = "width 0.4s ease";
  scoreBar.style.boxShadow = "inset 0 0 10px rgba(255, 0, 0, 0.6)";

  // Create score text
  const scoreText = document.createElement("span");
  scoreText.className = "score-text";
  scoreText.style.position = "absolute";
  scoreText.style.right = "20px";
  scoreText.style.top = "50%";
  scoreText.style.transform = "translateY(-50%)";
  scoreText.style.fontSize = "20px";
  scoreText.style.fontWeight = "bold";
  scoreText.style.color = "white";
  scoreText.style.textShadow = "1px 1px 0 #0b2e0b, -1px -1px 0 #0b2e0b";
  scoreText.style.zIndex = "1000";

  scoreWrapper.appendChild(scoreText);
  scoreWrapper.appendChild(scoreBar);
  document.body.appendChild(scoreWrapper);

  // Optional gradient helper (no longer used, but kept if needed)
  function getGradientColor(score) {
    const red = Math.round(255 - score * 2.55);
    const green = Math.round(score * 2.55);
    return `rgb(${red}, ${green}, 0)`;
  }

  // ✅ Update score bar and label
  window.updateScore = function (score) {
    window.currentScore = Math.max(0, Math.min(100, score));
    sessionStorage.setItem("currentScore", window.currentScore);

    scoreBar.style.width = `${window.currentScore}%`;

    // 🧪 Liquid-style gradient and animation
    scoreBar.style.background = `
      repeating-linear-gradient(
        -45deg,
        rgba(255, 50, 50, 0.6),
        rgba(255, 50, 50, 0.6) 10px,
        rgba(180, 0, 0, 0.6) 10px,
        rgba(180, 0, 0, 0.6) 20px
      )`;

    scoreBar.style.backgroundSize = "40px 40px";
    scoreBar.style.animation = "liquidWave 1s linear infinite";

    scoreText.textContent = `${window.currentScore}/100`;

    if (
      typeof window.getLevelThreshold === "function" &&
      typeof window.increaseLevel === "function" &&
      window.currentScore >= window.getLevelThreshold(window.currentLevel || 1)
    ) {
      window.increaseLevel();
    }
  };

  window.freezeScore = function () {
    window.levelOver = true;
    console.log(
      "Score freezing enabled. No further updates will be processed.",
    );
  };

  window.resetScore = function () {
    window.currentScore = 0;
    sessionStorage.setItem("currentScore", "0");
    scoreBar.style.width = "0%";
    scoreBar.style.backgroundColor = getGradientColor(0);
    scoreText.textContent = "0/100";
  };

  const socket = window.socket || io("http://localhost:3000");
  window.socket = socket;

  socket.on("scoreUpdate", (allScores) => {
    if (
      typeof window.currentScore !== "number" ||
      isNaN(window.currentScore) ||
      allScores.healthScore !== window.currentScore
    ) {
      console.log("Initializing score:", allScores.healthScore);
      if (!window.levelOver) window.updateScore(allScores.healthScore);
    }
    window.bullyScore = allScores.bullyScore || 0;
    window.bystanderScore = allScores.bystanderScore || 0;
  });
});
