document.getElementById("add-root").addEventListener("click", () => {
  const container = document.getElementById("tree-container");
  container.appendChild(createNodeElement());
});

document.getElementById("export").addEventListener("click", exportJSON);

function createNodeElement(id = "", title = "", text = "", image = "") {
  const template = document.getElementById("node-template");
  const nodeEl = template.content.cloneNode(true);

  nodeEl.querySelector(".node-id").value = id;
  nodeEl.querySelector(".node-title").value = title;
  nodeEl.querySelector(".node-text").value = text;
  nodeEl.querySelector(".node-image").value = image;

  const addChoiceBtn = nodeEl.querySelector(".add-choice");
  const choicesContainer = nodeEl.querySelector(".choices");

  addChoiceBtn.addEventListener("click", () => {
    const choiceEl = createChoiceElement();
    choicesContainer.appendChild(choiceEl);
  });

  return nodeEl;
}

function createChoiceElement() {
  const template = document.getElementById("choice-template");
  const choiceEl = template.content.cloneNode(true);

  const addChildBtn = choiceEl.querySelector(".add-child-node");
  const childContainer = choiceEl.querySelector(".child-container");

  addChildBtn.addEventListener("click", () => {
    const nextId = choiceEl.querySelector(".choice-next")?.value.trim();
    const childNode = createNodeElement(nextId); // Pre-fill child node ID
    childContainer.appendChild(childNode);
  });

  return choiceEl;
}

function extractNode(nodeEl) {
  const id = nodeEl.querySelector(".node-id")?.value.trim();
  const title = nodeEl.querySelector(".node-title")?.value.trim();
  const text = nodeEl.querySelector(".node-text")?.value.trim();
  const image = nodeEl.querySelector(".node-image")?.value.trim();

  if (!id) return null;

  const choices = [];
  nodeEl.querySelectorAll(":scope > .choices > .choice").forEach(choiceEl => {
    const choiceText = choiceEl.querySelector(".choice-text")?.value.trim();
    const nextId = choiceEl.querySelector(".choice-next")?.value.trim();
    const childNodeEl = choiceEl.querySelector(".child-container .node");
    const childNode = childNodeEl ? extractNode(childNodeEl) : null;

    const choice = {
      text: choiceText,
      next: nextId || (childNode ? childNode.id : undefined)
    };

    if (childNode) {
      choices.push({ ...choice, node: childNode });
    } else {
      choices.push(choice);
    }
  });

  const node = { id, title, text, choices };
  if (image) node.image = image;
  return node;
}

function exportJSON() {
  const allNodes = {};

  function collectNode(node) {
    if (!node.id || allNodes[node.id]) return;

    const flatNode = {
      id: node.id,
      title: node.title,
      text: node.text,
      choices: []
    };

    if (node.image) flatNode.image = node.image;

    for (const choice of node.choices || []) {
      flatNode.choices.push({ text: choice.text, next: choice.next });
      if (choice.node) {
        collectNode(choice.node);
      }
    }

    allNodes[node.id] = flatNode;
  }

  const rootNodeContainers = document.querySelectorAll('.node-container > .node');
  rootNodeContainers.forEach(container => {
    const node = extractNode(container);
    if (node) {
      collectNode(node);
    }
  });

  const finalArray = Object.values(allNodes);

  let filenameInput = document.getElementById("filename-input")?.value.trim();
  if (!filenameInput) filenameInput = "story-events";

  const blob = new Blob([JSON.stringify(finalArray, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameInput}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
