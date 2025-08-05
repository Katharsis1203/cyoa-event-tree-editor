document.getElementById("add-root").addEventListener("click", () => {
  const container = document.getElementById("tree-container");
  container.appendChild(createNodeElement());
});

document.getElementById("export").addEventListener("click", exportJSON);

function createNodeElement(prefilledId = "") {
  const template = document.getElementById("node-template");
  const nodeEl = template.content.cloneNode(true);

  if (prefilledId) {
    const idInput = nodeEl.querySelector(".node-id");
    idInput.value = prefilledId;
  }

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

  const nextIdInput = choiceEl.querySelector(".choice-next");
  const addChildBtn = choiceEl.querySelector(".add-child-node");
  const childContainer = choiceEl.querySelector(".child-container");

  // Show the "Describe Destination Node" button when there's input
  nextIdInput.addEventListener("input", () => {
    addChildBtn.style.display = nextIdInput.value.trim() ? "inline-block" : "none";
  });

  addChildBtn.addEventListener("click", () => {
    const existing = childContainer.querySelector(".node");
    if (existing) return; // Prevent adding multiple

    const nextId = nextIdInput.value.trim();
    if (!nextId) return;

    const newNode = createNodeElement(nextId);
    childContainer.appendChild(newNode);
  });

  return choiceEl;
}

function extractNode(nodeEl) {
  const id = nodeEl.querySelector(".node-id")?.value.trim();
  const title = nodeEl.querySelector(".node-title")?.value.trim();
  const text = nodeEl.querySelector(".node-text")?.value.trim();

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

  return { id, title, text, choices };
}

function exportJSON() {
  const allNodes = {};
  const rootNodes = [];

  function collectNode(node) {
    if (!node.id || allNodes[node.id]) return;
    const flatNode = {
      id: node.id,
      title: node.title,
      text: node.text,
      choices: []
    };

    for (const choice of (node.choices || [])) {
      flatNode.choices.push({
        text: choice.text,
        next: choice.next
      });

      if (choice.node) {
        collectNode(choice.node);
      }
    }

    allNodes[node.id] = flatNode;
  }

  // Gather root nodes and build tree
  const rootNodeContainers = document.querySelectorAll('.node-container > .node');
  rootNodeContainers.forEach(container => {
    const node = extractNode(container);
    if (node) {
      rootNodes.push(node);
      collectNode(node);
    }
  });

  // Final order: root nodes first, then the rest
  const sortedArray = [
    ...rootNodes.map(root => allNodes[root.id]),
    ...Object.values(allNodes).filter(n => !rootNodes.some(root => root.id === n.id))
  ];

  const blob = new Blob([JSON.stringify(sortedArray, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const rootId = sortedArray[0]?.id?.replace(/\./g, "-") || "story-tree";
  a.href = url;
  a.download = `${rootId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
