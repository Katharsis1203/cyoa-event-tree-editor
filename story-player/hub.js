// hub.js — robust SPA-ready hub

(function(){
  // State
  let hubData = null;
  const state = { events: [null, null, null] };
  let slots = [];
  let tpl = null;
  let actionButtons = [];

  // Simple logger
  const log = (...args) => console.log("[HUB]", ...args);
  const warn = (...args) => console.warn("[HUB]", ...args);
  const err  = (...args) => console.error("[HUB]", ...args);

  // Requirements check (very permissive placeholders for now)
  function requirementsMet(reqs, player) {
    if (!reqs || !reqs.length) return true;
    return reqs.every(req => {
      if (req.type === 'stat') {
        const val = (player.stats||{})[req.key] ?? 0;
        if (req.gte !== undefined && val < req.gte) return false;
        if (req.lte !== undefined && val > req.lte) return false;
        if (req.eq  !== undefined && val !== req.eq) return false;
        return true;
      }
      if (req.type === 'relationship') {
        const val = (player.relationships||{})[req.key] ?? 0;
        if (req.gte !== undefined && val < req.gte) return false;
        if (req.lte !== undefined && val > req.lte) return false;
        if (req.eq  !== undefined && val !== req.eq) return false;
        return true;
      }
      if (req.type === 'flag') {
        return !!((player.flags||{})[req.name]);
      }
      // time, day, familiarity -> allow for now
      return true;
    });
  }

  // Weighted random
  function weightedPick(list) {
    const total = list.reduce((s, c) => s + (c.weight || 1), 0);
    if (total <= 0) return list[0];
    let r = Math.random() * total;
    for (const c of list) {
      r -= (c.weight || 1);
      if (r <= 0) return c;
    }
    return list[list.length - 1];
  }

  // Player placeholder (replace with real state when you wire it)
  const player = { stats:{}, relationships:{}, flags:{} };

  // Eligible pool by button source
  function getEligibleFrom(sourceKey) {
    if (!hubData || !Array.isArray(hubData.cards)) return [];
    const keyToCategory = { hub:'life', player:'player', special:'special' };
    const wantCat = keyToCategory[sourceKey] ?? null;
    const out = hubData.cards.filter(card => {
      if (wantCat && card.category !== wantCat) return false;
      return requirementsMet(card.requirements, player);
    });
    log("Eligible", sourceKey, "→", out.length);
    return out;
  }

  // Render the three slots
  function renderSlots() {
    if (!tpl) { warn("Missing #event-template; cannot render"); return; }
    slots.forEach((slotEl, i) => {
      slotEl.innerHTML = '';
      const ev = state.events[i];
      if (!ev) {
        const empty = document.createElement('div');
        empty.className = 'event-empty';
        empty.textContent = 'Empty';
        slotEl.appendChild(empty);
        return;
      }
      const node = tpl.content.cloneNode(true);
      const title = ev.id || ev.opens?.nodeFile || 'Event';
      const img = ev.opens?.image || '';
      node.querySelector('.event-title').textContent = title;
      node.querySelector('.event-snippet').textContent = ev.category || '';
      const imgEl = node.querySelector('.event-img');
      if (img) imgEl.src = img; else imgEl.removeAttribute('src');
      node.querySelector('.enter-btn').addEventListener('click', () => onPlayCard(i, ev));
      node.querySelector('.remove-btn').addEventListener('click', () => { state.events[i] = null; renderSlots(); });
      slotEl.appendChild(node);
    });
  }
  window.renderSlots = renderSlots; // allow glue to call on showHub()

  // Enter -> SPA glue (or fallback redirect)
  function onPlayCard(slotIndex, card) {
    try {
      const nodeFile = card?.opens?.nodeFile;
      const nodeId   = card?.opens?.nodeId || 'start';
      if (!nodeFile) { warn("Card missing opens.nodeFile", card); return; }

      if (typeof window.showNode === 'function' && typeof window.loadNodeFromFileAndId === 'function') {
        window.showNode();
        window.loadNodeFromFileAndId(nodeFile, nodeId);
      } else {
        // fallback: navigate to node page
        window.location.href = `index.html?file=${encodeURIComponent(nodeFile)}&id=${encodeURIComponent(nodeId)}`;
      }
      // mark slot empty; render when hub is shown again
      state.events[slotIndex] = null;
    } catch (e) {
      err("onPlayCard failed", e);
    }
  }

  // Fill only empty slots; ensure unique IDs across visible set
  function fillEmptySlotsFrom(sourceKey) {
    if (!hubData) { warn("Hub data not loaded yet"); return; }
    const eligible = getEligibleFrom(sourceKey);
    if (!eligible.length) { renderSlots(); return; }

    const usedIds = new Set(state.events.filter(Boolean).map(ev => ev.id));
    for (let i = 0; i < state.events.length; i++) {
      if (state.events[i]) continue;
      const pool = eligible.filter(c => !usedIds.has(c.id));
      if (!pool.length) break;
      const pick = weightedPick(pool);
      state.events[i] = { ...pick };
      usedIds.add(pick.id);
    }
    renderSlots();
  }

  // Load hub JSON, set background
  async function loadHubJson(path = 'forest_hub.json') {
    log("Loading hub JSON:", path);
    const res = await fetch(path);
    if (!res.ok) throw new Error('Failed to load hub json: ' + path);
    hubData = await res.json();
    log("Hub loaded. Cards:", Array.isArray(hubData.cards) ? hubData.cards.length : 0);

    // expose background for glue
    window.hubBackground = hubData.background || window.hubBackground || "";
    if (hubData.background) {
      document.body.style.backgroundImage = `url('${hubData.background}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    }
    renderSlots();
  }

  // Init after DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    tpl = document.getElementById('event-template');
    slots = Array.from(document.querySelectorAll('.event-slot'));
    actionButtons = Array.from(document.querySelectorAll('#actions .img-btn'));

    if (!tpl) warn("Template #event-template not found");
    if (!slots.length) warn("No .event-slot elements found");
    if (!actionButtons.length) warn("No action buttons found");

    actionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const source = btn.dataset.source;
        log("Action pressed:", source);
        fillEmptySlotsFrom(source);
      });
    });

    // Tabs behavior (unchanged from your build)
    const tabs = document.querySelectorAll('#tabbar .tab');
    const panels = {
      character: document.getElementById('panel-character'),
      inventory: document.getElementById('panel-inventory'),
      quests: document.getElementById('panel-quests'),
      status: document.getElementById('panel-status'),
    };
    let openPanel = null;
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const key = tab.dataset.panel;
        const panel = panels[key];
        if (!panel) return;
        Object.values(panels).forEach(p => p.classList.remove('open'));
        if (openPanel === panel) {
          panel.classList.remove('open');
          openPanel = null;
        } else {
          panel.classList.add('open');
          openPanel = panel;
        }
      });
    });
    document.addEventListener('click', (e) => {
      const isTab = e.target.closest('#tabbar .tab');
      const isPanel = e.target.closest('#panels .panel.open');
      if (!isTab && !isPanel && openPanel) {
        openPanel.classList.remove('open');
        openPanel = null;
      }
    });

    // Kick off
    renderSlots(); // shows empties first
    loadHubJson().catch(e => err(e));
  });
})();
