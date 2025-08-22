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

  // --- Child node authoring ---
  const addChildBtn = choiceEl.querySelector(".add-child-node");
  const childContainer = choiceEl.querySelector(".child-container");
  addChildBtn.addEventListener("click", () => {
    const nextId = choiceEl.querySelector(".choice-next")?.value.trim();
    const childNode = createNodeElement(nextId); // Pre-fill child node ID
    childContainer.appendChild(childNode);
  });

  // --- Stat checks UI ---
  const addSCBtn = choiceEl.querySelector(".add-statcheck");
  const scList = choiceEl.querySelector(".statcheck-list");
  addSCBtn.addEventListener("click", () => {
    scList.appendChild(createStatCheckElement());
  });

  // --- Outcomes UI ---
  const addOutcomeBtn = choiceEl.querySelector(".add-outcome");
  const outcomeList = choiceEl.querySelector(".outcome-list");
  addOutcomeBtn.addEventListener("click", () => {
    outcomeList.appendChild(createOutcomeElement());
  });

  return choiceEl;
}

function createStatCheckElement() {
  const template = document.getElementById("statcheck-template");
  const scEl = template.content.cloneNode(true);

  scEl.querySelector(".remove-statcheck").addEventListener("click", (e) => {
    e.target.closest(".statcheck").remove();
  });

  return scEl;
}

function createOutcomeChoiceElement() {
  const template = document.getElementById("outcome-choice-template");
  const ocEl = template.content.cloneNode(true);

  ocEl.querySelector(".remove-outcome-choice").addEventListener("click", (e) => {
    e.target.closest(".outcome-choice").remove();
  });

  return ocEl;
}

function createOutcomeElement() {
  const template = document.getElementById("outcome-template");
  const outEl = template.content.cloneNode(true);

  // remove outcome
  outEl.querySelector(".remove-outcome").addEventListener("click", (e) => {
    e.target.closest(".outcome").remove();
  });

  // add outcome choice
  const addOutcomeChoiceBtn = outEl.querySelector(".add-outcome-choice");
  const ocList = outEl.querySelector(".outcome-choice-list");
  addOutcomeChoiceBtn.addEventListener("click", () => {
    ocList.appendChild(createOutcomeChoiceElement());
  });

  return outEl;
}

function extractNode(nodeEl) {
  const id = nodeEl.querySelector(".node-id")?.value.trim();
  const title = nodeEl.querySelector(".node-title")?.value.trim();
  const text = nodeEl.querySelector(".node-text")?.value.trim();
  const image = nodeEl.querySelector(".node-image")?.value.trim();

  if (!id) return null;

  const choices = [];
  nodeEl.querySelectorAll(":scope > .choices > .choice").forEach(choiceEl => {
    choices.push(extractChoice(choiceEl));
  });

  const node = { id, title, text, choices };
  if (image) node.image = image;
  return node;
}

function extractChoice(choiceEl) {
  const choiceText = choiceEl.querySelector(".choice-text")?.value.trim();
  const nextId = choiceEl.querySelector(".choice-next")?.value.trim();

  // Stat checks bundle
  const statChecks = [];
  choiceEl.querySelectorAll(".statcheck").forEach(sc => {
    const stat = sc.querySelector(".stat-name")?.value.trim();
    const difficultyRaw = sc.querySelector(".stat-difficulty")?.value.trim();
    if (stat) {
      const difficulty = difficultyRaw === "" ? 0 : parseInt(difficultyRaw, 10);
      statChecks.push({ stat, difficulty });
    }
  });

  // Outcomes
  const outcomes = {};
  choiceEl.querySelectorAll(".outcome").forEach(out => {
    const key = out.querySelector(".outcome-successes")?.value.trim();
    if (!key) return;

    const resultText = out.querySelector(".outcome-result")?.value.trim();
    const next = out.querySelector(".outcome-next")?.value.trim();

    // Parse effects JSON if provided
    let effects = undefined;
    const effectsText = out.querySelector(".outcome-effects")?.value.trim();
    if (effectsText) {
      try { effects = JSON.parse(effectsText); } catch (e) { /* ignore bad JSON silently */ }
    }

    // Outcome-specific choices (optional)
    const oc = [];
    out.querySelectorAll(".outcome-choice").forEach(ocEl => {
      const t = ocEl.querySelector(".outcome-choice-text")?.value.trim();
      const n = ocEl.querySelector(".outcome-choice-next")?.value.trim();
      if (t && n) oc.push({ text: t, next: n });
    });

    const outcomeObj = {};
    if (resultText) outcomeObj.resultText = resultText;
    if (effects) outcomeObj.effects = effects;
    if (next) outcomeObj.next = next;
    if (oc.length > 0) outcomeObj.choices = oc;

    outcomes[key] = outcomeObj;
  });

  // Inline child node (optional)
  const childNodeEl = choiceEl.querySelector(".child-container .node");
  const childNode = childNodeEl ? extractNode(childNodeEl) : null;

  const choice = { text: choiceText };
  if (nextId) choice.next = nextId;
  if (statChecks.length > 0) choice.statChecks = statChecks;
  if (Object.keys(outcomes).length > 0) choice.outcomes = outcomes;
  if (childNode) choice.node = childNode;

  return choice;
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
      // keep backwards compatibility
      const outChoice = { text: choice.text };
      if (choice.next) outChoice.next = choice.next;
      if (choice.statChecks) outChoice.statChecks = choice.statChecks;
      if (choice.outcomes) outChoice.outcomes = choice.outcomes;

      flatNode.choices.push(outChoice);

      // Recurse into inline child nodes
      if (choice.node) collectNode(choice.node);
    }

    allNodes[node.id] = flatNode;
  }

  const rootNodeContainers = document.querySelectorAll('.node-container > .node');
  rootNodeContainers.forEach(container => {
    const node = extractNode(container);
    if (node) collectNode(node);
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
