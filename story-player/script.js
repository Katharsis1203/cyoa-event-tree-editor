let nodes = {};
let currentNode = null;

document.getElementById("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const json = JSON.parse(event.target.result);
      loadGame(json);
    } catch (err) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
});

function loadGame(nodeArray) {
  // Build lookup table
  nodes = {};
  for (const node of nodeArray) {
    nodes[node.id] = node;
  }

  // Start at first root node
  const root = nodeArray[0];
  if (!root) return alert("No nodes found.");

  document.getElementById("game").classList.remove("hidden");
  goToNode(root.id);
}

function goToNode(id) {
  const node = nodes[id];
  if (!node) return alert(`Node ${id} not found.`);

  currentNode = node;

  document.getElementById("nodeTitle").textContent = node.title || "(No Title)";
  document.getElementById("nodeText").textContent = node.text || "(No Text)";

  const choicesDiv = document.getElementById("choices");
  choicesDiv.innerHTML = "";

  for (const choice of node.choices || []) {
    const btn = document.createElement("button");
    btn.textContent = choice.text || "(Unnamed Choice)";
    btn.onclick = () => goToNode(choice.next);
    choicesDiv.appendChild(btn);
  }
}
