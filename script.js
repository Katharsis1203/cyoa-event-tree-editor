document.getElementById("add-root").addEventListener("click", () => {
  const container = document.getElementById("tree-container");
  container.appendChild(createNodeElement());
});

document.getElementById("export").addEventListener("click", () => {
  const nodes = [];
  document.querySelectorAll(".node").forEach(nodeEl => {
    const node = extractNode(nodeEl);
    if (node) nodes.push(node);
  });

  const filename = nodes[0]?.id || "story-tree";
  const blob = new Blob([JSON.stringify(nodes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

function createNodeElement() {
  const template = document.getElementById("node-template");
  const nodeEl = template.content.cloneNode(true);

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
    const childNode = createNodeElement();
    childContainer.appendChild(childNode);
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
