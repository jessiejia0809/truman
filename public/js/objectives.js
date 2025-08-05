// Global tracker for hints used
let hintsUsed = new Set();

async function loadObjectives(level) {
  console.log("Loading objectives for level:", level);
  try {
    const res = await fetch(`/api/objectives?level=${level}`);
    const objectives = await res.json();

    const list = document.getElementById("objectives-list");
    if (!list) {
      console.error("❌ objectives-list element not found in DOM.");
      return;
    }
    list.innerHTML = "";

    for (const obj of objectives) {
      const li = document.createElement("li");
      li.className = "objective-item checklist-item";
      if (obj.completed) li.classList.add("completed");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = obj.completed;
      checkbox.disabled = true;

      const label = document.createElement("span");
      label.textContent = obj.label;
      label.className = "objective-label";

      const toggle = document.createElement("span");
      toggle.textContent = "▸";
      toggle.className = "dropdown-arrow";

      const hint = document.createElement("div");
      hint.className = "objective-details";
      hint.textContent = obj.hint || "No hint available.";
      hint.style.display = "none";

      toggle.addEventListener("click", () => {
        const isVisible = hint.style.display === "block";
        hint.style.display = isVisible ? "none" : "block";
        toggle.textContent = isVisible ? "▸" : "▾";
      });

      const topRow = document.createElement("div");
      topRow.className = "flex-row";
      topRow.appendChild(checkbox);
      topRow.appendChild(toggle);
      topRow.appendChild(label);

      li.appendChild(topRow);
      li.appendChild(hint);

      list.appendChild(li);
    }
  } catch (err) {
    console.error("❌ Failed to load objectives:", err);
  }
}

// ✅ Expose globally
window.loadObjectives = loadObjectives;

document.addEventListener("DOMContentLoaded", () => {
  const checklistPanel = document.createElement("div");
  checklistPanel.className = "checklist";
  checklistPanel.innerHTML = `
    <h2>Objectives</h2>
    <ul id="objectives-list"></ul>
    <style>
      .objective-item {
        margin-bottom: 10px;
        list-style-type: none;
      }
      .objective-label {
        margin-left: 8px;
        font-weight: bold;
      }
      .hint-button {
        margin-left: 12px;
        padding: 2px 6px;
        font-size: 0.9em;
        cursor: pointer;
      }
      .objective-details {
        margin-top: 6px;
        padding-left: 20px;
        font-style: italic;
        color: #444;
      }
    </style>
  `;
  document.body.appendChild(checklistPanel);

  const urlParams = new URLSearchParams(window.location.search);
  const currentLevel = urlParams.get("level") || 1;
  loadObjectives(currentLevel);
});
