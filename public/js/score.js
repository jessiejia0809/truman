document.addEventListener("DOMContentLoaded", () => {
  let scoreValue = 0;

  // Create wrapper
  const scoreWrapper = document.createElement("div");
  scoreWrapper.style.position = "fixed";
  scoreWrapper.style.top = "100px";
  scoreWrapper.style.left = "130px";
  scoreWrapper.style.width = "300px";
  scoreWrapper.style.height = "30px";
  scoreWrapper.style.backgroundColor = "#222";
  scoreWrapper.style.borderRadius = "10px";
  scoreWrapper.style.overflow = "hidden";
  scoreWrapper.style.zIndex = "1000";

  // Score fill bar
  const scoreBar = document.createElement("div");
  scoreBar.style.height = "80%";
  scoreBar.style.width = "0%";
  scoreBar.style.borderRadius = "10px";
  scoreBar.style.transition = "width 0.4s ease";

  // Score label
  const scoreText = document.createElement("span");
  scoreText.style.position = "absolute";
  scoreText.style.right = "20px";
  scoreText.style.top = "50%";
  scoreText.style.transform = "translateY(-50%)";
  scoreText.style.fontSize = "20px";
  scoreText.style.fontWeight = "bold";
  scoreText.style.color = "white";
  scoreText.style.textShadow = "1px 1px 0 #0b2e0b, -1px -1px 0 #0b2e0b";
  scoreText.style.zIndex = "1000";
  scoreText.textContent = `${scoreValue}/100`;

  scoreWrapper.appendChild(scoreText);
  scoreWrapper.appendChild(scoreBar);
  document.body.appendChild(scoreWrapper);

  function getGradientColor(score) {
    const red = Math.round(255 - score * 2.55);
    const green = Math.round(score * 2.55);
    return `rgb(${red}, ${green}, 0)`;
  }

  // ✅ Global method to update score

  window.updateScore = function (score) {
    scoreValue = Math.max(0, Math.min(100, score));
    const percent = scoreValue;
    window.currentScore = scoreValue;
    scoreBar.style.width = `${percent}%`;
    scoreBar.style.backgroundColor = getGradientColor(scoreValue);
    scoreText.textContent = `${scoreValue}/100`;

    if (
      typeof window.getLevelThreshold === "function" &&
      typeof window.increaseLevel === "function" &&
      scoreValue >= window.getLevelThreshold(window.currentLevel || 1)
    ) {
      window.increaseLevel();
    }
  };

  // ✅ Global method to reset score
  window.resetScore = function () {
    scoreValue = 0;
    scoreBar.style.width = "0%";
    scoreBar.style.backgroundColor = getGradientColor(0);
    scoreText.textContent = "0/100";
  };

  const socket = io();

  // Listen for score updates from server
  socket.on("scoreUpdate", (allScores) => {
    //console.log("Received scores:", allScores);

    // Example: log all bystander usernames and scores
    for (const [username, score] of Object.entries(allScores.bystanderScores)) {
      //console.log(`Bystander: ${username} - ${score}`);
    }

    // Example: get overall health score
    //console.log("Health score:", allScores.healthScore);
    window.bystanderScore = allScores.bystanderScore;
    window.bullyScore = allScores.bullyScore;
    window.updateScore(allScores.healthScore);
  });
});
