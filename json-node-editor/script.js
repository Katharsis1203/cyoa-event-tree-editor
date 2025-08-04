function addChoice() {
    const div = document.createElement('div');
    div.className = 'choice-container';
    div.innerHTML = `
      <label>Choice Text</label>
      <input type="text" class="choice-text" placeholder="e.g., Run away" />
      <label>Next Node ID</label>
      <input type="text" class="choice-next" placeholder="e.g., escapePath" />
      <button onclick="createNextNode(this)">+ Create Next Node</button>
    `;
    choicesContainer.appendChild(div);
  }
  
  function createNextNode(btn) {
    const nextId = btn.parentElement.querySelector('.choice-next').value.trim();
    if (!nextId) {
      alert("Please enter the 'Next Node ID' first.");
      return;
    }
  
    // Create a new node form dynamically
    const newNodeSection = document.createElement('div');
    newNodeSection.innerHTML = `
      <h3>Create Node: ${nextId}</h3>
      <label>Node Type</label>
      <input type="text" class="child-node-type" placeholder="e.g., passage" />
      <label>Title</label>
      <input type="text" class="child-title" />
      <label>Text</label>
      <textarea class="child-text" rows="3"></textarea>
    `;
    btn.parentElement.appendChild(newNodeSection);
  }
  