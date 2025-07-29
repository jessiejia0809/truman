document.addEventListener("DOMContentLoaded", () => {
  const checklistPanel = document.createElement("div");
  checklistPanel.className = "checklist";
  checklistPanel.innerHTML = `
    <h2>Objectives</h2>
    <ul id="objectives-list"></ul>
  `;
  document.body.appendChild(checklistPanel);

  async function loadObjectives(level) {
    try {
      const res = await fetch(`/api/objectives?level=${level}`);
      const objectives = await res.json();

      const list = document.getElementById("objectives-list");
      list.innerHTML = "";

      for (const obj of objectives) {
        const li = document.createElement("li");
        li.className = "objective-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = obj.completed;
        checkbox.disabled = true;
        checkbox.dataset.id = obj._id;

        const label = document.createElement("span");
        label.textContent = obj.label || "(no label)";

        li.appendChild(checkbox);
        li.appendChild(label);
        list.appendChild(li);
      }
    } catch (err) {
      console.error("Failed to load objectives:", err);
    }
  }

  // Use current level from query string or default to 1
  const urlParams = new URLSearchParams(window.location.search);
  const currentLevel = urlParams.get("level") || 1;
  loadObjectives(currentLevel);
});
