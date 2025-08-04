const nodes = {};
const choicesContainer = document.getElementById('choices-container');
const output = document.getElementById('json-output');

function addChoice() {
  const div = document.createElement('div');
  div.className = 'choice-container';
  div.innerHTML = `
    <label>Choice Text</label>
    <input type="text" class="choice-text" placeholder="e.g., Run away" />
    <label>Next Node ID</label>
    <input type="text" class="choice-next" placeholder="e.g., escapePath" />
  `;
  choicesContainer.appendChild(div);
}

function saveNode() {
  const id = document.getElementById('node-id').value.trim();
  const type = document.getElementById('node-type').value.trim();
  const title = document.getElementById('title').value.trim();
  const text = document.getElementById('text').value.trim();

  if (!id || !type || !text) {
    alert("Please fill in at least Node ID, Type, and Text.");
    return;
  }

  const choiceDivs = document.querySelectorAll('.choice-container');
  const choices = Array.from(choiceDivs).map(div => {
    return {
      text: div.querySelector('.choice-text').value,
      next: div.querySelector('.choice-next').value
    };
  }).filter(c => c.text && c.next);

  nodes[id] = { type, title, text, choices };
  output.textContent = JSON.stringify(nodes, null, 2);

  // Clear form
  document.getElementById('node-id').value = '';
  document.getElementById('node-type').value = '';
  document.getElementById('title').value = '';
  document.getElementById('text').value = '';
  choicesContainer.innerHTML = '<h3>Choices</h3>';
}

function downloadJSON() {
  const json = JSON.stringify(nodes, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'story-tree.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
