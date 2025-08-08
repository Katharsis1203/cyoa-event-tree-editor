import { playerState, applyEffects } from './player.js';
import { isChoiceAvailable } from './logic.js';

let storyData = [];
let currentNode = null;

document.getElementById("file-input").addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (!file) return;

  playerState.fileName = file.name;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      storyData = JSON.parse(e.target.result);
      const startNode = storyData[0];
      playerState.nodeId = startNode.id;
      displayNode(startNode);
    } catch (err) {
      alert("Failed to parse JSON file.");
      console.error(err);
    }
  };
  reader.readAsText(file);
});

function displayNode(node) {
  currentNode = node;

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
  if (imageEl && imageContainer) {
    if (node.image) {
      imageEl.src = `images/${node.image}`;
      imageContainer.style.display = "block";
    } else {
      imageContainer.style.display = "none";
    }
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
    if (!isChoiceAvailable(choice)) return;

    const button = document.createElement("button");
    button.textContent = choice.text;
    button.addEventListener("click", () => {
      applyEffects(choice.effects);
      const nextNode = storyData.find(n => n.id === choice.next);
      if (nextNode) {
        playerState.nodeId = nextNode.id;
        displayNode(nextNode);
      } else {
        const fallbackFile = `events/${choice.next.replace(/\./g, "-")}.json`;
        fetch(fallbackFile)
          .then(res => res.json())
          .then(newData => {
            storyData = newData;
            const newStartNode = storyData.find(n => n.id === choice.next) || storyData[0];
            playerState.nodeId = newStartNode.id;
            displayNode(newStartNode);
          })
          .catch(err => {
            console.error("Failed to load file:", fallbackFile);
            alert("Could not load next event.");
          });
      }
    });
    choicesContainer.appendChild(button);
  });

  renderStats();
}

function renderStats() {
  const statsList = document.getElementById("stats-list");
  statsList.innerHTML = "";

  for (let stat in playerState.stats) {
    const li = document.createElement("li");
    li.textContent = `${stat}: ${playerState.stats[stat]}`;
    statsList.appendChild(li);
  }
}