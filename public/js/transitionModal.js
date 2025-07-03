window.showTransitionPopup = function (result = "lose") {
  console.log("Transition result:", result);
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
      button.innerText = result === "win" ? "Next Level" : "Retry";
      button.style.marginTop = "20px";
      button.style.padding = "10px 20px";
      button.style.fontSize = "16px";
      button.style.cursor = "pointer";
      button.onclick = () => {
        modalOverlay.remove();
        // optionally trigger level progression
        if (result === "win" && typeof window.goToNextLevel === "function")
          goToNextLevel();
        if (typeof window.resetTimer === "function") resetTimer();
        if (typeof window.resetScore === "function") resetScore();
      };

      modalBox.appendChild(button);
      modalOverlay.appendChild(modalBox);
      document.body.appendChild(modalOverlay);
    });
};
