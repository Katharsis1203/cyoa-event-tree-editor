import { applyEffects, playerState, getPlayerState } from './player.js';
import { isChoiceAvailable } from './logic.js';

let currentNodes = {};
let currentNodeId = null;

document.getElementById("file-input").addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      currentNodes = {};
      data.forEach(node => {
        currentNodes[node.id] = node;
      });
      currentNodeId = data[0].id;
      displayNode(currentNodeId);
    } catch (err) {
      alert("Failed to parse JSON file.");
      console.error(err);
    }
  };
  reader.readAsText(file);
});
function renderStats() {
  const ul = document.getElementById("stats-list");
  if (!ul) return;
  ul.innerHTML = "";
  for (const [k, v] of Object.entries(playerState.stats || {})) {
    const li = document.createElement('li');
    li.textContent = `${k}: ${v}`;
    ul.appendChild(li);
  }
}
function displayNode(id) {
  const node = currentNodes[id];
  if (!node) {
    alert("Node not found: " + id);
    return;
  }

  currentNodeId = id;

  document.getElementById("node-title").textContent = node.title;
  document.getElementById("node-text").textContent = node.text;
  if (node.background) {
    document.body.style.backgroundImage = `url('images/${node.background}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
  } else {
    document.body.style.backgroundImage = '';
  }

  const imageEl = document.getElementById("node-image");
  const imageContainer = document.getElementById("node-image-container");

  if (node.image) {
    imageEl.src = `images/${node.image}`;
    imageContainer.style.display = "block";
  } else {
    imageContainer.style.display = "none";
  }

  const choicesContainer = document.getElementById("choices-container");
  choicesContainer.innerHTML = "";

  if (!node.choices || node.choices.length === 0) {
    const endMessage = document.createElement("p");
    endMessage.textContent = "The end.";
    choicesContainer.appendChild(endMessage);
    return;
  }

  node.choices.forEach(choice => {
    const button = document.createElement("button");
    button.textContent = choice.text;
    button.addEventListener("click", () => {
      applyEffects(choice.effects); // <-- your player logic
      renderStats();

      // Try to show next node
      if (currentNodes[choice.next]) {
        displayNode(choice.next);
      } else {
        const fallbackFile = `events/${choice.next.replace(/\./g, "-")}.json`;
        fetch(fallbackFile)
          .then(res => {
            if (!res.ok) throw new Error("File not found");
            return res.json();
          })
          .then(newData => {
            newData.forEach(n => {
              currentNodes[n.id] = n; // ✅ Merge nodes into memory
            });
            if (currentNodes[choice.next]) {
              displayNode(choice.next);
            } else {
              alert("Node not found even after loading file.");
            }
          })
          .catch(() => {
            alert("Failed to load file: " + fallbackFile);
          });
      }
    });
    choicesContainer.appendChild(button);
  });
}
