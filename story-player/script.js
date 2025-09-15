// script.js — node passage renderer (SPA-safe)
// Imports
import { applyEffects, playerState, getPlayerState } from './player.js';
import { isChoiceAvailable } from './logic.js';

// Globals (share with glue)
window.currentNodes = window.currentNodes || {};
window.currentNodeId = window.currentNodeId || null;

let injectedFlavour = null;   // transient flavour shown on next render
let injectedChecks  = null;   // transient [{stat, pass}] shown on next render
let prevBackgroundSrc = "";   // cache to avoid needless bg swaps

const $ = (id) => document.getElementById(id);

/* ---------- ASSET PATH NORMALIZER ---------- */
function resolveSrc(src) {
  if (!src) return "";
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("images/")) return src;
  return `images/${src}`;
}

/* ---------- CHECK / ROLL HELPERS ---------- */
function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function statPassPct(player, req) {
  if (!Number.isFinite(req) || req <= 0) return 100;
  const pct = (player / req) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
function statPassProb(player, req) {
  if (!Number.isFinite(req) || req <= 0) return 1;
  return clamp01(player / req);
}
function rollSuccess(player, req) {
  if (!Number.isFinite(req) || req <= 0) return true;
  return Math.random() < clamp01(player / req);
}

/* ---------- WEIGHTED BUCKET RESOLUTION ---------- */
function pickWeightedBucket(statChecks, weighted, passMap) {
  if (!weighted || !Array.isArray(weighted.buckets) || weighted.buckets.length === 0) return null;

  // 1) Tally scores
  const scores = {};
  for (const b of weighted.buckets) scores[b.id] = 0;

  for (const sc of (statChecks || [])) {
    const stat = sc.stat;
    if (!stat) continue;
    if (!passMap[stat]) continue; // only passed stats add weight
    const row = (weighted.weights && weighted.weights[stat]) || {};
    for (const [bucketId, w] of Object.entries(row)) {
      if (scores[bucketId] == null) continue;
      const n = Number(w);
      if (!Number.isFinite(n)) continue;
      scores[bucketId] += n;
    }
  }

  // 2) Eligible + all
  const eligible = [];
  const all = [];
  for (const b of weighted.buckets) {
    const score = scores[b.id] || 0;
    const threshold = Number(b.threshold) || 0;
    const entry = { bucket: b, score };
    all.push(entry);
    if (score >= threshold) eligible.push(entry);
  }

  // choose among entries by score; "first"/"highest" keeps author order on ties
  function chooseBest(arr) {
    if (arr.length === 0) return null;
    const mode = weighted.tiebreak || "first";
    if (mode === "random") {
      const maxScore = Math.max(...arr.map(e => e.score));
      const tied = arr.filter(e => e.score === maxScore);
      return tied[Math.floor(Math.random() * tied.length)];
    } else {
      let best = arr[0];
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].score > best.score) best = arr[i];
      }
      return best;
    }
  }

  const winner = chooseBest(eligible) || chooseBest(all);
  return winner ? winner.bucket : null;
}

/* ---------- CHECKS SUMMARY RENDERER (transient) ---------- */
function prettyStatName(key) {
  if (!key) return "";
  return key.charAt(0).toUpperCase() + key.slice(1);
}
function renderChecksSummary() {
  const el = $("checks-summary");
  if (!el) return;

  if (!Array.isArray(injectedChecks) || injectedChecks.length === 0) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }

  const frag = document.createDocumentFragment();
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = 'Checks';
  frag.appendChild(title);

  const ul = document.createElement('ul');
  injectedChecks.forEach(rc => {
    const li = document.createElement('li');
    const stat = document.createElement('span');
    stat.className = 'stat';
    stat.textContent = prettyStatName(rc.stat);

    const result = document.createElement('span');
    result.className = 'result ' + (rc.pass ? 'pass' : 'fail');
    result.textContent = rc.pass ? 'Success' : 'Fail';

    li.appendChild(stat);
    li.appendChild(result);
    ul.appendChild(li);
  });
  frag.appendChild(ul);

  el.innerHTML = "";
  el.appendChild(frag);
  el.style.display = "block";
}

/* ---------- HOVER REVEAL (bind once) ---------- */
const initHoverReveal = (() => {
  let initialized = false;
  return (container) => {
    if (initialized || !container) return;
    initialized = true;
    container.addEventListener('mouseover', (e) => {
      const btn = e.target.closest('.choice-scroll');
      if (btn && container.contains(btn)) btn.classList.add('reveal');
    });
    container.addEventListener('mouseout', (e) => {
      const btn = e.target.closest('.choice-scroll');
      if (btn && container.contains(btn)) btn.classList.remove('reveal');
    });
  };
})();

/* ---------- CORE RENDERING ---------- */
window.displayNode = function displayNode(id) {
  if (!id) return;
  const node = window.currentNodes[id];
  if (!node) {
    console.warn("Node not found:", id, window.currentNodes);
    return;
  }
  window.currentNodeId = id;

  $("node-title").textContent = node.title ?? "";

  // Foreground image
  const imageEl = $("node-image");
  const imageContainer = $("node-image-container");
  if (node.image) {
    imageEl.setAttribute('decoding', 'async');
    imageEl.setAttribute('loading', 'eager');
    const src = resolveSrc(node.image);
    if (imageEl.src !== src) imageEl.src = src;
    imageContainer.style.display = "block";
  } else {
    imageContainer.style.display = "none";
  }

  // Background (only change if different)
  const bgSrc = node.background ? resolveSrc(node.background) : "";
  if (bgSrc !== prevBackgroundSrc) {
    prevBackgroundSrc = bgSrc;
    if (bgSrc) {
      document.body.style.backgroundImage = `url('${bgSrc}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    } else {
      document.body.style.backgroundImage = '';
    }
  }

  // Inject checks summary (if any) BEFORE flavour + body
  renderChecksSummary();

  // Flavour
  const flavourEl = $("flavour-block");
  if (injectedFlavour && injectedFlavour.trim()) {
    flavourEl.textContent = injectedFlavour;
    flavourEl.style.display = "block";
  } else {
    flavourEl.textContent = "";
    flavourEl.style.display = "none";
  }
  $("node-text").textContent = node.text ?? "";

  // Choices
  const choicesContainer = $("choices-container");
  choicesContainer.innerHTML = "";
  if (!node.choices || node.choices.length === 0) {
    const endMessage = document.createElement("p");
    endMessage.textContent = "The end.";
    choicesContainer.appendChild(endMessage);
    injectedFlavour = null;
    injectedChecks  = null;
    return;
  }

  const frag = document.createDocumentFragment();

  node.choices.forEach(choice => {
    if (!isChoiceAvailable(choice)) return;

    const scroll = document.createElement("button");
    scroll.type = "button";
    scroll.className = "choice-scroll";
    if (choice.type === "checked") scroll.classList.add("checked");

    const head = document.createElement("div");
    head.className = "choice-head";

    const textEl = document.createElement("div");
    textEl.className = "choice-text";
    textEl.textContent = choice.text ?? "(choice)";
    head.appendChild(textEl);

    if (choice.type === "checked" && Array.isArray(choice.statChecks) && choice.statChecks.length > 0) {
      const meta = document.createElement("div");
      meta.className = "choice-meta";
      meta.textContent = "Hover to view individual checks";

      const reveal = document.createElement("div");
      reveal.className = "checks-reveal";

      const chips = document.createElement("div");
      chips.className = "checks-list";

      choice.statChecks.forEach(sc => {
        const p = getPlayerState(sc.stat) ?? 0;
        const pct = statPassPct(p, sc.difficulty);
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = `${sc.stat} ${pct}%`;
        chips.appendChild(chip);
      });

      reveal.appendChild(chips);
      scroll.appendChild(head);
      scroll.appendChild(meta);
      scroll.appendChild(reveal);
    } else {
      scroll.appendChild(head);
    }

    scroll.addEventListener("click", () => {
      // Apply pre-choice effects (if any)
      if (choice.effects) {
        applyEffects(choice.effects);
        renderStats();
      }

      if (choice.type === "simple") {
        injectedFlavour = null;
        injectedChecks  = null;
        if (choice.next) {
          goToNext(choice.next);
        } else {
          alert("Choice has no next node.");
        }
        return;
      }

      if (choice.type === "checked") {
        const statChecks = choice.statChecks || [];
        const weighted   = choice.weighted;

        if (!weighted || !weighted.buckets || weighted.buckets.length === 0) {
          alert("This checked choice has no outcome buckets.");
          return;
        }

        // 1) Roll each check; record for transient summary
        const rollResults = statChecks.map(sc => {
          const player = getPlayerState(sc.stat) ?? 0;
          const pass   = rollSuccess(player, sc.difficulty);
          return { stat: sc.stat, pass };
        });

        // 2) Build pass map for tallies
        const passMap = Object.fromEntries(rollResults.map(r => [r.stat, r.pass]));

        // 3) Resolve weighted winner
        const winner = pickWeightedBucket(statChecks, weighted, passMap);
        if (!winner) {
          alert("No outcome bucket was selected.");
          return;
        }

        // 4) Apply outcome effects first (if any)
        if (winner.effects) {
          applyEffects(winner.effects);
          renderStats();
        }

        // 5) Set transients for the NEXT render
        injectedChecks  = rollResults;
        injectedFlavour = (winner.flavourText || "").trim() || null;

        // 6) Navigate (or re-render same node)
        if (winner.next) {
          goToNext(winner.next);
        } else {
          window.displayNode(window.currentNodeId);
        }
        return;
      }

      // Fallback
      if (choice.next) {
        injectedFlavour = null;
        injectedChecks  = null;
        goToNext(choice.next);
      } else {
        alert("Choice has no next node.");
      }
    });

    frag.appendChild(scroll);
  });

  choicesContainer.appendChild(frag);
  initHoverReveal(choicesContainer);

  // Clear transients AFTER one render
  injectedFlavour = null;
  injectedChecks  = null;
};

/* ---------- NAVIGATION ---------- */
function goToNext(nextId) {
  if (!nextId) return;

  if (nextId === 'HUB' && typeof window.showHub === 'function') {
    // Return to hub view in SPA
    window.showHub();
    return;
  }

  if (window.currentNodes[nextId]) {
    window.displayNode(nextId);
    return;
  }

  // Fallback: try to load another file based on id
  const fallbackFile = `events/${String(nextId).replace(/\./g, "-")}.json`;
  fetch(fallbackFile)
    .then(res => {
      if (!res.ok) throw new Error("File not found");
      return res.json();
    })
    .then(newData => {
      newData.forEach(n => { window.currentNodes[n.id] = n; });
      if (window.currentNodes[nextId]) {
        window.displayNode(nextId);
      } else {
        alert("Node not found even after loading file.");
      }
    })
    .catch(() => alert("Failed to load file: " + fallbackFile));
}

/* ---------- FILE PICKER (manual testing) ---------- */
const fileInput = $("file-input");
if (fileInput) {
  fileInput.addEventListener("change", function (event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        window.currentNodes = {};
        data.forEach(node => { window.currentNodes[node.id] = node; });
        window.currentNodeId = data[0]?.id ?? null;
        if (!window.currentNodeId) throw new Error("No nodes in file");
        window.displayNode(window.currentNodeId);
        renderStats();
      } catch (err) {
        alert("Failed to parse JSON file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  });
}

/* ---------- RIGHT SHEET TABS & UNDER SHEETS ---------- */
const leftSheet  = document.getElementById("undersheet-left");
const rightSheet = document.getElementById("undersheet-right");

const leftTab  = document.getElementById("tab-left")  || document.querySelector(".pull-left");
const rightTab = document.getElementById("tab-right") || document.querySelector(".pull-right");

leftTab?.addEventListener("click", () => { leftSheet?.classList.toggle("open"); });
rightTab?.addEventListener("click", () => { rightSheet?.classList.toggle("open"); });

document.querySelectorAll(".under .close-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    const aside = (e.currentTarget).closest(".under");
    aside?.classList.remove("open");
  });
});

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const name = btn.dataset.tab;
    btn.parentElement.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tabpane").forEach(p => p.style.display = "none");
    const pane = document.getElementById("tab-" + name);
    if (pane) pane.style.display = "block";
  });
});

/* ---------- STATS RENDERER (if you show a live stat list elsewhere) ---------- */
function renderStats() {
  const ul = $("stats-list");
  if (!ul) return;
  ul.innerHTML = "";
  for (const [k, v] of Object.entries(playerState.stats || {})) {
    const li = document.createElement('li');
    li.textContent = `${k}: ${v}`;
    ul.appendChild(li);
  }
}

// No default init here on purpose (SPA-safe).
// Standalone index.html could call window.displayNode('start') explicitly.
