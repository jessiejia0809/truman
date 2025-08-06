let hintsUsed = new Set();

async function loadObjectives(level) {
  console.log("📌 Loading objectives for level:", level);
  try {
    const res = await fetch(`/api/objectives?level=${level}`);
    const objectives = await res.json();

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

    for (const obj of objectives) {
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
      if (expandedObjectives.has(obj.label)) {
        hint.style.display = "block";
        toggle.textContent = "▾";
      } else {
        hint.style.display = "none";
      }

      toggle.addEventListener("click", () => {
        const isVisible = hint.style.display === "block";
        hint.style.display = isVisible ? "none" : "block";
        toggle.textContent = isVisible ? "▸" : "▾";

        if (isVisible) {
          expandedObjectives.delete(obj.label);
        } else {
          expandedObjectives.add(obj.label);
        }
      });

      const row = document.createElement("div");
      row.className = "objective-header";
      row.appendChild(checkbox);
      row.appendChild(toggle);
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

// Load when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const currentLevel = urlParams.get("level") || 1;
  loadObjectives(currentLevel);
});

// Expose globally
window.loadObjectives = loadObjectives;
