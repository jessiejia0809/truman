/*(function () {
  const socket = io();

  let lastActionTimestamp = Date.now();
  let lastDecayTime = Date.now();
  window.levelOver = false; // 🆕 Added global flag

  function getGradientColor(score) {
    const red = Math.round(255 - score * 2.55);
    const green = Math.round(score * 2.55);
    return `rgb(${red}, ${green}, 0)`;
  }

  window.updateScore = function (newScore, fromAction = false) {
    window.currentScore = Math.max(0, newScore);
    if (!window.allScores) {
      window.allScores = {};
    }
    window.allScores.healthScore = window.currentScore;
    sessionStorage.setItem("currentScore", window.currentScore);

    const scoreBar = document.querySelector(".score-bar");
    const scoreText = document.querySelector(".score-text");

    if (scoreBar) {
      const percent = Math.max(0, Math.min(100, window.currentScore));
      scoreBar.style.width = percent + "%";
      scoreBar.style.backgroundColor = getGradientColor(percent);
    }

    if (scoreText) {
      scoreText.textContent = `${window.currentScore}/100`;
    }

    if (fromAction) {
      lastActionTimestamp = Date.now();
    }
  };

  window.initScoreBar = function () {
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

    const scoreBar = document.createElement("div");
    scoreBar.className = "score-bar";
    scoreBar.style.height = "80%";
    scoreBar.style.width = "0%";
    scoreBar.style.borderRadius = "10px";
    scoreBar.style.transition = "width 0.4s ease";

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

    window.updateScore(window.currentScore);
  };

  socket.on("scoreUpdate", (allScores) => {
    const initialScore = parseInt(allScores.healthScore);
    const isNew = !window.allScores;

    window.allScores = allScores;
    console.log(isNew ? "Initializing scores" : "Updating scores", allScores);
    if (isNew) {
      window.currentScore = isNaN(initialScore) ? 100 : initialScore;
      window.updateScore(window.currentScore, true);
    }

    if (!window.scoreBarInitialized) {
      window.scoreBarInitialized = true;
      window.initScoreBar();
    }

    if (!window.scoreDecayStarted) {
      window.scoreDecayStarted = true;
      setInterval(() => {
        const now = Date.now();
        const timeSinceLastAction = now - lastActionTimestamp;
        const timeSinceLastDecay = now - lastDecayTime;

        // ⛔ Don't decay after level ends
        if (window.levelOver) return;

        if (
          typeof window.currentScore === "number" &&
          window.currentScore > 0 &&
          timeSinceLastAction >= 1000 &&
          timeSinceLastDecay >= 1000
        ) {
          window.updateScore(window.currentScore - 1);
          lastDecayTime = now;
        }
      }, 1000); // check every second
    }
  });
})();*/

document.addEventListener("DOMContentLoaded", () => {
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
  scoreBar.style.height = "80%";
  scoreBar.style.width = "0%";
  scoreBar.style.position = "absolute";
  scoreBar.style.top = "50%";
  scoreBar.style.transform = "translateY(-50%)";
  scoreBar.style.borderRadius = "10px";
  scoreBar.style.transition = "width 0.4s ease";

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
    scoreBar.style.backgroundColor = getGradientColor(window.currentScore);
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
    // 🆕 Prevent score decay
    window.levelOver = true;
    console.log(
      "Score freezing enabled. No further updates will be processed.",
    );
  };

  // ✅ Reset score if needed
  window.resetScore = function () {
    window.currentScore = 0;
    sessionStorage.setItem("currentScore", "0");
    scoreBar.style.width = "0%";
    scoreBar.style.backgroundColor = getGradientColor(0);
    scoreText.textContent = "0/100";
  };

  const socket = window.socket || io("http://localhost:3000");
  window.socket = socket;

  // ✅ Receive updated scores from server
  socket.on("scoreUpdate", (allScores) => {
    if (
      typeof window.currentScore !== "number" ||
      isNaN(window.currentScore) ||
      allScores.healthScore !== window.currentScore
    ) {
      console.log("Initializing score:", allScores.healthScore);
      if (!window.levelOver) window.updateScore(allScores.healthScore);
    }
  });
});
