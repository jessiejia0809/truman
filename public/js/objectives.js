let hintsUsed = new Set();

async function loadObjectives(level) {
  if (window.victoryTriggered) return;
  console.log("📌 Loading objectives for level:", level);
  try {
    const res = await fetch(`/api/objectives?level=${level}`);
    const objectives = await res.json();

    objectives.sort((a, b) => a.order - b.order);

    const existing = document.querySelector(".checklist-panel");
    if (existing) existing.remove();

    const checklistPanel = document.createElement("div");
    checklistPanel.className = "checklist-panel";

    const title = document.createElement("h2");
    title.textContent = "Objectives";
    checklistPanel.appendChild(title);

    const list = document.createElement("ul");
    list.id = "objectives-list";
    list.className = "checklist";
    checklistPanel.appendChild(list);

    for (let i = 0; i < objectives.length; i++) {
      const obj = objectives[i];
      const prev = objectives[i - 1];

      const li = document.createElement("li");
      li.className = "objective-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.disabled = true;
      checkbox.checked = obj.completed;

      const label = document.createElement("span");
      label.className = "objective-label";
      label.textContent = obj.label || "(Unnamed Objective)";

      const toggle = document.createElement("span");
      toggle.textContent = "▸";
      toggle.className = "dropdown-arrow";
      toggle.style.cursor = "pointer";

      const hint = document.createElement("div");
      hint.className = "objective-details";
      hint.textContent = obj.hint || "No hint available.";
      hint.style.display = "none";

      toggle.addEventListener("click", () => {
        const isVisible = hint.style.display === "block";
        hint.style.display = isVisible ? "none" : "block";
        toggle.textContent = isVisible ? "▸" : "▾";
      });

      const row = document.createElement("div");
      row.className = "objective-header";
      row.appendChild(checkbox);
      row.appendChild(toggle);

      // Determine status
      const isUnlocked = i === 0 || (prev && prev.completed);
      if (!isUnlocked && !obj.completed) {
        li.classList.add("locked");
        const lockIcon = document.createElement("span");
        lockIcon.textContent = "🔒";
        lockIcon.className = "lock-icon";
        row.appendChild(lockIcon);
      }

      if (obj.completed) {
        li.classList.add("completed");
      }

      row.appendChild(label);
      li.appendChild(row);
      li.appendChild(hint);
      list.appendChild(li);
    }

    const wrapper =
      document.getElementById("objectives-panel") || document.body;
    wrapper.appendChild(checklistPanel);
  } catch (err) {
    console.error("❌ Failed to load objectives:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const currentLevel = urlParams.get("level") || 1;
  loadObjectives(currentLevel);
});

window.loadObjectives = loadObjectives;

window.resetObjectives = function () {
  if (!Array.isArray(window.objectives)) return;

  window.objectives.forEach((obj) => (obj.completed = false));

  // Also update UI if needed
  document.querySelectorAll(".objective").forEach((el) => {
    el.classList.remove("completed");
  });

  console.log("🧹 Objectives reset.");
};
