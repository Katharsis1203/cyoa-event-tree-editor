let storyData = [];
let currentNode = null;

document.getElementById("file-input").addEventListener("change", function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      storyData = JSON.parse(e.target.result);
      const startNode = storyData[0];
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

  const imageEl = document.getElementById("node-image");
  if (node.image) {
    imageEl.src = `images/${node.image}`;
    imageEl.style.display = "block";
  } else {
    imageEl.style.display = "none";
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
      const nextNode = storyData.find(n => n.id === choice.next);
      if (nextNode) {
        displayNode(nextNode);
      } else {
        const fallbackFile = `events/${choice.next.replace(/\./g, "-")}.json`;
        fetch(fallbackFile)
          .then(res => res.json())
          .then(newData => {
            storyData = newData;
            const newStartNode = storyData.find(n => n.id === choice.next) || storyData[0];
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
}
