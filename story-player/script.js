
let currentNodes = {};
let currentNodeId = null;

document.getElementById("fileInput").addEventListener("change", function (e) {
  const file = e.target.files[0];
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
      alert("Failed to parse JSON");
    }
  };
  reader.readAsText(file);
});

function displayNode(id) {
  const node = currentNodes[id];
  if (!node) {
    alert("Node not found: " + id);
    return;
  }

  document.getElementById("game").classList.remove("hidden");
  document.getElementById("nodeTitle").textContent = node.title;
  document.getElementById("nodeText").textContent = node.text;

  const choicesContainer = document.getElementById("choices");
  choicesContainer.innerHTML = "";
  node.choices.forEach(choice => {
    const button = document.createElement("button");
    button.textContent = choice.text;
    button.onclick = () => handleChoice(choice.next);
    choicesContainer.appendChild(button);
  });
}


function handleChoice(nextId) {
  if (currentNodes[nextId]) {
    displayNode(nextId);
  } else {
    const fileName = nextId.replace(/\./g, "-") + ".json";
    fetch("events/" + fileName)
      .then(res => {
        if (!res.ok) throw new Error("File not found");
        return res.json();
      })
      .then(data => {
        data.forEach(node => {
          currentNodes[node.id] = node;
        });
        if (currentNodes[nextId]) {
          displayNode(nextId);
        } else {
          alert("Node not found even after loading file.");
        }
      })
      .catch(() => {
        alert("Failed to load file: " + fileName);
      });
  }
}
