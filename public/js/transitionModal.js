window.showTransitionPopup = function (
  result = "lose",
  feedback = [],
  finalScore = null,
) {
  console.log("Showing transition popup:", result);

  const file =
    result === "win"
      ? "/public/js/win_screen.json"
      : "/public/js/lose_screen.json";

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
      modalOverlay.style.backgroundColor = "rgba(0,0,0,0.6)";
      modalOverlay.style.display = "flex";
      modalOverlay.style.justifyContent = "center";
      modalOverlay.style.alignItems = "center";
      modalOverlay.style.zIndex = "9999";

      const modalBox = document.createElement("div");
      modalBox.style.backgroundColor = result === "lose" ? "#8b0000" : "#fff";
      modalBox.style.padding = "30px";
      modalBox.style.borderRadius = "15px";
      modalBox.style.color = "#fff";
      modalBox.style.width = "400px";
      modalBox.style.boxShadow = "0 0 20px rgba(0,0,0,0.5)";
      modalBox.style.textAlign = "center";
      modalBox.style.fontFamily = "monospace";

      if (result === "lose") {
        const title = document.createElement("h1");
        title.innerText = "You Failed";
        title.style.fontSize = "2em";
        modalBox.appendChild(title);

        // Score circle
        const scoreCircle = document.createElement("div");
        const scoreValue = finalScore ?? 0;
        console.log("Final score:", scoreValue);

        scoreCircle.innerHTML = `
          <svg viewBox="0 0 36 36" width="100" height="100" style="margin: 10px auto; display: block;">
            <path
              fill="none"
              stroke="#333"
              stroke-width="3.8"
              d="M18 2.0845
                 a 15.9155 15.9155 0 0 1 0 31.831
                 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              fill="none"
              stroke="#00ff00"
              stroke-width="2.8"
              stroke-dasharray="${scoreValue}, 100"
              d="M18 2.0845
                 a 15.9155 15.9155 0 0 1 0 31.831
                 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <text x="18" y="20.35" fill="#fff" font-size="6" text-anchor="middle">${scoreValue}</text>
          </svg>
        `;
        modalBox.appendChild(scoreCircle);

        // Score breakdown
        const by = document.createElement("p");
        by.innerText = `Bystander Score: ${Math.trunc(window.bystanderScore * 100) ?? "?"}%`;
        const bu = document.createElement("p");
        bu.innerText = `Bully Score: ${Math.trunc(window.bullyScore * 100) ?? "?"}%`;
        modalBox.appendChild(by);
        modalBox.appendChild(bu);

        /*// Harmful actions
        const actionHeader = document.createElement("h3");
        actionHeader.innerText = "ACTIONS THAT CONTRIBUTED TO FAILURE";
        actionHeader.style.marginTop = "15px";
        modalBox.appendChild(actionHeader);

        const ul = document.createElement("ul");
        ul.style.textAlign = "left";

        feedback.forEach((item) => {
          const li = document.createElement("li");
          li.innerText = `• Verbal Harassment towards ${item.target?.owner || "unknown"}: “${item.text.slice(0, 60)}...”`;
          ul.appendChild(li);
        });

        modalBox.appendChild(ul);*/

        // Hint
        const hint = document.createElement("p");
        hint.style.marginTop = "20px";
        hint.innerText = "Hint: Try to support victims with affirming comments";
        modalBox.appendChild(hint);

        // Retry button
        const retryBtn = document.createElement("button");
        retryBtn.innerText = "↻";
        retryBtn.style.fontSize = "1.5em";
        retryBtn.style.marginTop = "15px";
        retryBtn.style.background = "none";
        retryBtn.style.color = "#fff";
        retryBtn.style.border = "2px solid #fff";
        retryBtn.style.borderRadius = "50%";
        retryBtn.style.padding = "10px 14px";
        retryBtn.style.cursor = "pointer";

        retryBtn.onclick = () => window.retryLevel();

        modalBox.appendChild(retryBtn);
      } else {
        // Default win screen logic using JSON
        modalBox.style.backgroundColor = "#720000";
        modalBox.style.border = "5px solid #ab0909";

        const title = document.createElement("h1");
        title.innerText = "You Passed";
        title.style.color = "#fff";
        title.style.fontFamily = "'Courier New', monospace";
        title.style.fontSize = "3em";
        modalBox.appendChild(title);

        const arrowBtn = document.createElement("button");
        arrowBtn.innerText = "➔";
        arrowBtn.style.backgroundColor = "#fff";
        arrowBtn.style.color = "#b20000";
        arrowBtn.style.fontSize = "2em";
        arrowBtn.style.border = "none";
        arrowBtn.style.borderRadius = "50%";
        arrowBtn.style.width = "65px";
        arrowBtn.style.height = "65px";
        arrowBtn.style.cursor = "pointer";
        arrowBtn.onclick = () => window.goToNextLevel();

        modalBox.appendChild(arrowBtn);
      }

      modalOverlay.appendChild(modalBox);
      document.body.appendChild(modalOverlay);
    });
};
