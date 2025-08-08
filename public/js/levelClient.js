window.socket = window.socket || io("http://localhost:3000");

let currentLevel =
  parseInt(new URLSearchParams(window.location.search).get("level")) || 1;

window.getCurrentLevel = function () {
  return currentLevel;
};

window.goToNextLevel = function () {
  const nextLevel = currentLevel + 1;

  // Notify server BEFORE redirecting
  window.socket.emit("levelChanged", { level: nextLevel });
  window.resetScore?.();
  window.resetObjectives?.();
  window.location.href = `/feed?level=${nextLevel}`;
};

window.retryLevel = async function () {
  const currentLevel =
    parseInt(new URLSearchParams(window.location.search).get("level")) || 1;

  window.socket.emit("resetLevel", { level: currentLevel });
  console.log("🔄 Level reset requested via socket.");
  // Wait and reload the same level
  setTimeout(() => {
    window.location.href = `/feed?level=${currentLevel}`;
  }, 300);
};

window.checkWinCondition = async function (score, remainingTime) {
  await fetchAndRenderObjectives();
  console.log("Checking win condition for level", currentLevel);

  if (score < 100 && remainingTime > 0) {
    console.log("⏸️ Not ready to win yet.");
    return;
  }

  if (currentLevel == 1 && score == 100) {
    console.log("Level 1 complete!");
    window.freezeScore?.();
    window.freezeTimer?.();
    showBullyingPopup();
  } else if (score === 100) {
    console.log("Level complete!");
    window.freezeScore?.();
    window.freezeTimer?.();
    showBullyingPopup();
  } else if (remainingTime <= 0) {
    window.freezeScore();
    window.freezeTimer?.();
    console.log("Time's up! Checking for win condition.");
    window.showTransitionPopup("lose", score);
  }
};

function showBullyingPopup() {
  const popup = document.createElement("div");
  popup.id = "bullyingPopup";
  popup.style.position = "fixed";
  popup.style.bottom = "20px";
  popup.style.left = "50%";
  popup.style.transform = "translateX(-50%)";
  popup.style.background = "#ffdddd";
  popup.style.padding = "20px";
  popup.style.border = "1px solid #ff0000";
  popup.style.borderRadius = "10px";
  popup.style.zIndex = "9999";
  popup.innerHTML = `
    <strong>🎯 Great job!</strong><br>
    Before completing this level, please review the bullying post.<br><br>
    <button id="reviewBullyingBtn" class="ui red button">Review Now</button>
  `;

  document.body.appendChild(popup);

  document
    .getElementById("reviewBullyingBtn")
    .addEventListener("click", async () => {
      popup.remove(); // Only now begin scroll → wait → win

      try {
        const res = await fetch(
          `/api/bullying-post?level=${window.getCurrentLevel()}`,
        );
        const { bullyingPostId } = await res.json();

        if (!bullyingPostId) throw new Error("No bullying post ID");

        const bullyingPost = document.querySelector(
          `[postid="${bullyingPostId}"]`,
        );

        if (bullyingPost) {
          console.log("📌 Found bullying post:", bullyingPostId);

          // Scroll and wait for scroll completion
          bullyingPost.scrollIntoView({ behavior: "smooth", block: "center" });

          // ⏱️ Wait 10 seconds after scroll
          setTimeout(() => {
            console.log("✅ 10s complete. Showing transition popup.");
            window.showTransitionPopup("win");
          }, 10000);
        } else {
          console.warn("⚠️ Bullying post not found in DOM. Completing anyway.");
          window.showTransitionPopup("win");
        }
      } catch (err) {
        console.error("❌ Failed to load bullying post:", err);
        window.showTransitionPopup("win");
      }
    });
}

document.addEventListener("keydown", function (e) {
  if (e.key === "r" || e.key === "R") {
    const active = document.activeElement;
    const isTyping =
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable);

    if (!isTyping) {
      const confirmReset = confirm(
        "🔁 Are you sure you want to restart this level?",
      );
      if (confirmReset) {
        window.retryLevel?.();
      }
    }
  }
});

async function fetchAndRenderObjectives() {
  const level = window.getCurrentLevel?.() || 1;
  try {
    const res = await fetch(`/api/objectives?level=${level}`);
    const objectives = await res.json();
    window.loadObjectives?.(level);
  } catch (err) {
    console.error("Failed to load objectives:", err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  fetchAndRenderObjectives?.();
});

window.socket.on("objectiveFeedback", ({ unmatchedReasons }) => {
  if (!unmatchedReasons) return;
  console.log("Received objective feedback:", unmatchedReasons);
  const [category, reason] = unmatchedReasons;
  if (category && reason) {
    showObjectiveFeedbackPopup(category, reason);
  }
});

function showObjectiveFeedbackPopup(category, reason) {
  // Remove any existing one
  const old = document.getElementById("objective-feedback-popup");
  if (old) old.remove();

  const popup = document.createElement("div");
  popup.id = "objective-feedback-popup";
  popup.style.position = "fixed";
  popup.style.bottom = "30px";
  popup.style.right = "30px";
  popup.style.maxWidth = "300px";
  popup.style.padding = "20px";
  popup.style.backgroundColor = "#ffe0e0";
  popup.style.border = "2px solid #ff0000";
  popup.style.borderRadius = "10px";
  popup.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
  popup.style.zIndex = "10000";
  popup.style.fontFamily = "sans-serif";

  popup.innerHTML = `
    <strong>Objective Feedback</strong><br>
    <em>${category}</em><br>
    ${reason}
    <div style="margin-top:10px;text-align:right;">
      <button id="closeFeedbackBtn" style="
        background: #ff5555;
        border: none;
        color: white;
        padding: 5px 10px;
        border-radius: 5px;
        cursor: pointer;">Dismiss</button>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("closeFeedbackBtn").onclick = () => popup.remove();
}
