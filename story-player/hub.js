
function applyHubBackground(bg) {
  try {
    if (bg) {
      document.body.style.backgroundImage = `url('${bg}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    } else {
      document.body.style.backgroundImage = '';
    }
    document.body.classList.add('hub-bg');
  } catch (e) { }
}

// hub.js — SPA-ready hub with node-image peek, caching, no delete button, full-card click
(function () {
  let hubData = null;
  const state = { events: [null, null, null] };
  let slots = [];
  let tpl = null;
  let actionButtons = [];
  const nodeCache = {}; // caches node JSONs by file path
  const log = (...args) => console.log("[HUB]", ...args);
  const warn = (...args) => console.warn("[HUB]", ...args);

  const player = { stats: {}, relationships: {}, flags: {} }; // placeholder

  function requirementsMet(reqs, player) {
    if (!reqs || !reqs.length) return true;
    return reqs.every(req => {
      if (req.type === 'stat') {
        const val = (player.stats || {})[req.key] ?? 0;
        if (req.gte !== undefined && val < req.gte) return false;
        if (req.lte !== undefined && val > req.lte) return false;
        if (req.eq !== undefined && val !== req.eq) return false;
        return true;
      }
      if (req.type === 'relationship') {
        const val = (player.relationships || {})[req.key] ?? 0;
        if (req.gte !== undefined && val < req.gte) return false;
        if (req.lte !== undefined && val > req.lte) return false;
        if (req.eq !== undefined && val !== req.eq) return false;
        return true;
      }
      if (req.type === 'flag') {
        return !!((player.flags || {})[req.name]);
      }
      return true;
    });
  }

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

  function getEligibleFrom(sourceKey) {
    if (!hubData || !Array.isArray(hubData.cards)) return [];
    const keyToCategory = { hub: 'life', player: 'player', special: 'special' };
    const wantCat = keyToCategory[sourceKey] ?? null;
    const out = hubData.cards.filter(card => {
      if (wantCat && card.category !== wantCat) return false;
      return requirementsMet(card.requirements, player);
    });
    log("Eligible", sourceKey, "→", out.length);
    return out;
  }

  async function getNodeImage(ev) {
    if (ev.opens?.image) return ev.opens.image;
    const file = ev.opens?.nodeFile;
    const id = ev.opens?.nodeId || 'start';
    if (!file) return '';
    if (!nodeCache[file]) {
      try {
        const res = await fetch(file);
        if (!res.ok) throw new Error('Failed to fetch ' + file);
        const data = await res.json();
        const dict = {};
        data.forEach(n => dict[n.id] = n);
        nodeCache[file] = dict;
      } catch (e) {
        warn('Failed to load node file for image', file, e);
        nodeCache[file] = {};
      }
    }
    return nodeCache[file][id]?.image || '';
  }




  async function renderSlots() {
    if (!tpl) { warn("Missing #event-template"); return; }
    for (let i = 0; i < slots.length; i++) {
      const slotEl = slots[i];
      // retrigger animation on the parchment container itself
      slotEl.classList.remove('deal-in');
      void slotEl.offsetWidth; // reflow to restart animation
      slotEl.style.animationDelay = (i * 220) + 'ms';
      slotEl.classList.add('deal-in');
      // remove the animation class after it finishes, so hover transforms can take over
      slotEl.addEventListener('animationend', () => {
        slotEl.classList.remove('deal-in');
        slotEl.style.animationDelay = '';
      }, { once: true });

      slotEl.innerHTML = '';
      const ev = state.events[i];
      if (!ev) {
        const empty = document.createElement('div');
        empty.className = 'event-empty';
        empty.textContent = 'Empty';
        slotEl.appendChild(empty);
        continue;
      }

      const imgSrc = await getNodeImage(ev);

      // Pure image-only card
      const cardEl = document.createElement('div');
      cardEl.className = 'event-card';
      cardEl.style.backgroundImage = imgSrc ? `url('${imgSrc}')` : '';
      cardEl.style.backgroundSize = 'cover';
      cardEl.style.backgroundPosition = 'center';
      cardEl.style.backgroundRepeat = 'no-repeat';
      cardEl.style.padding = '0';
      cardEl.style.border = 'none';
      cardEl.style.boxShadow = 'none';
      cardEl.style.cursor = 'pointer';
      cardEl.style.position = 'relative';
      cardEl.style.overflow = 'hidden';
      // Ensure the card has visible height even without inner content
      cardEl.style.width = '100%';
      cardEl.style.aspectRatio = '3 / 2';

      cardEl.addEventListener('click', () => onPlayCard(i, ev));
      slotEl.appendChild(cardEl);
    }
  }
  window.renderSlots = renderSlots;




  function onPlayCard(slotIndex, card) {
    const nodeFile = card?.opens?.nodeFile;
    const nodeId = card?.opens?.nodeId || 'start';
    if (!nodeFile) { warn("Card missing opens.nodeFile", card); return; }

    if (typeof window.showNode === 'function' && typeof window.loadNodeFromFileAndId === 'function') {
      window.showNode();
      window.loadNodeFromFileAndId(nodeFile, nodeId);
    } else {
      window.location.href = `index.html?file=${encodeURIComponent(nodeFile)}&id=${encodeURIComponent(nodeId)}`;
    }
    state.events[slotIndex] = null; // clear when returning to hub
  }

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

  async function loadHubJson(path = 'forest_hub.json') {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Failed to load hub json: ' + path);
    hubData = await res.json();
    window.hubBackground = hubData.background || window.hubBackground || "";
    if (hubData.background) {
      document.body.style.backgroundImage = `url('${hubData.background}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    }
    renderSlots();
  }

  document.addEventListener('DOMContentLoaded', () => {
    tpl = document.getElementById('event-template');
    slots = Array.from(document.querySelectorAll('.event-slot'));
    // Give each card holder a small random tilt and make it focusable
    slots.forEach(slot => {
      const tilt = (Math.random() * 6 - 3).toFixed(2) + 'deg'; // −3°..+3°
      slot.style.setProperty('--slot-tilt', tilt);
      slot.tabIndex = 0; // so :focus-within works from keyboard too
    });

    actionButtons = Array.from(document.querySelectorAll('.img-btn'));
    actionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const source = btn.dataset.source;
        fillEmptySlotsFrom(source);
      });
    });
    renderSlots();
    loadHubJson().catch(e => console.error(e));
  });
})();

try { if (window.hubBackground) applyHubBackground(window.hubBackground); } catch (e) { }
