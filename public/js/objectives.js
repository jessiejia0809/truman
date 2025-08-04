// Global tracker for hints used
let hintsUsed = new Set();

async function loadObjectives(level) {
  try {
    const res = await fetch(`/api/objectives?level=${level}`);
    const objectives = await res.json();

    const list = document.getElementById("objectives-list");
    if (!list) return;

    list.innerHTML = "";

    for (const obj of objectives) {
      const li = document.createElement("li");
      li.className = "objective-item";

      // Checkbox (disabled for now)
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = obj.completed;
      checkbox.disabled = true;
      checkbox.dataset.id = obj._id;

      // Label
      const label = document.createElement("span");
      label.textContent = obj.label || "(no label)";
      label.className = "objective-label";

      // Details container (initially hidden)
      const details = document.createElement("div");
      details.textContent = obj.details || "No details available.";
      details.style.display = "none";
      details.className = "objective-details";

      // Hint button to reveal details
      const hintBtn = document.createElement("button");
      hintBtn.textContent = "Use Hint";
      hintBtn.className = "hint-button";
      hintBtn.addEventListener("click", () => {
        hintsUsed.add(obj._id);
        details.style.display = "block";
        hintBtn.disabled = true;
      });

      // Assemble list item
      li.appendChild(checkbox);
      li.appendChild(label);
      li.appendChild(hintBtn);
      li.appendChild(details);
      list.appendChild(li);
    }
  } catch (err) {
    console.error("Failed to load objectives:", err);
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
