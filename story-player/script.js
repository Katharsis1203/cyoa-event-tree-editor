// Existing imports/helpers from your player remain as-is
import { applyEffects, playerState, getPlayerState } from './player.js';
import { isChoiceAvailable } from './logic.js';

let currentNodes = {};
let currentNodeId = null;
let injectedFlavour = null;      // transient flavour text passed into next render
let injectedChecks  = null;      // transient array of { stat, pass } for next render

const $ = (id) => document.getElementById(id);

/* ---------- ASSET PATH NORMALIZER ---------- */
function resolveSrc(src) {
  if (!src) return "";
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("images/")) return src;
  return `images/${src}`;
}

/* ---------- CHECK / OUTCOME HELPERS ---------- */
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

/* Outcome-key parsing */
function parseKey(key){
  if (key === "*") return { type:"any" };
  if (/^\d+$/.test(key)) return { type:"eq", a: Number(key) };
  const m1 = key.match(/^(\d+)\+$/);
  if (m1) return { type:"ge", a: Number(m1[1]) };
  const m2 = key.match(/^(\d+)-(\d+)$/);
  if (m2) return { type:"range", a:Number(m2[1]), b:Number(m2[2]) };
  return { type:"unknown" };
}
function lowerBoundForKey(k){
  const p = parseKey(k);
  if (p.type === "eq") return p.a;
  if (p.type === "ge") return p.a;
  if (p.type === "range") return p.a;
  if (p.type === "any") return -1; // wildcard has no lower bound
  return -1;
}
function predicateForKey(k){
  const p = parseKey(k);
  if (p.type === "eq")    return (s)=> s === p.a;
  if (p.type === "ge")    return (s)=> s >= p.a;
  if (p.type === "range") return (s)=> s >= p.a && s <= p.b;
  if (p.type === "any")   return (_)=> true;
  return (_)=> false;
}

/* Probability distribution over number of successes for independent checks */
function distributionFor(statChecks){
  // dp[i][s] = prob after i checks having exactly s successes
  const n = statChecks.length;
  const dp = Array.from({length:n+1}, () => Array(n+1).fill(0));
  dp[0][0] = 1;
  for (let i=1;i<=n;i++){
    const sc = statChecks[i-1];
    const p  = statPassProb(getPlayerState(sc.stat) ?? 0, sc.difficulty);
    for (let s=0; s<=i; s++){
      // fail path
      dp[i][s] += dp[i-1][s] * (1-p);
      // success path
      if (s>0) dp[i][s] += dp[i-1][s-1] * p;
    }
  }
  return dp[n]; // array length n+1, sum ~1
}

/* Pick best band from outcomes (highest lower bound) and compute its probability */
function overallChance(statChecks, outcomesObj){
  if (!outcomesObj || Object.keys(outcomesObj).length === 0) return 0;

  const keys = Object.keys(outcomesObj);
  // choose the band with max lower bound (i.e., the "best" outcome band)
  let bestKey = keys[0];
  let bestLB  = lowerBoundForKey(bestKey);
  for (const k of keys){
    const lb = lowerBoundForKey(k);
    if (lb > bestLB) { bestLB = lb; bestKey = k; }
  }
  const pred = predicateForKey(bestKey);
  const dist = distributionFor(statChecks);
  let prob = 0;
  for (let s=0; s<dist.length; s++){
    if (pred(s)) prob += dist[s];
  }
  return Math.round(prob * 100);
}

/* Choose the actual outcome band for a realized number of successes */
function pickOutcome(outcomesObj, successes) {
  if (!outcomesObj) return null;
  const keys = Object.keys(outcomesObj);

  // exact
  const exact = keys.find(k => /^\d+$/.test(k) && Number(k) === successes);
  if (exact) return [exact, outcomesObj[exact]];

  // range a-b
  const rangeKey = keys.find(k => {
    const m = k.match(/^(\d+)-(\d+)$/);
    if (!m) return false;
    const a = Number(m[1]), b = Number(m[2]);
    return successes >= a && successes <= b;
  });
  if (rangeKey) return [rangeKey, outcomesObj[rangeKey]];

  // plus n+
  const plusKey = keys.find(k => /^(\d+)\+$/.test(k) && successes >= Number(k.replace('+','')));
  if (plusKey) return [plusKey, outcomesObj[plusKey]];

  // wildcard
  if (outcomesObj["*"]) return ["*", outcomesObj["*"]];

  return null;
}

/* ---------- RENDER STATS ---------- */
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

/* ---------- CHECKS SUMMARY RENDERER (transient, post-click) ---------- */
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

  const items = injectedChecks.map(rc => {
    const resultClass = rc.pass ? "pass" : "fail";
    const resultText  = rc.pass ? "Success" : "Fail";
    return `
      <li>
        <span class="stat">${prettyStatName(rc.stat)}</span>
        <span class="result ${resultClass}">${resultText}</span>
      </li>`;
  }).join("");

  el.innerHTML = `
    <div class="title">Checks</div>
    <ul>${items}</ul>
  `;
  el.style.display = "block";
}

/* ---------- CORE RENDERING ---------- */
function displayNode(id) {
  const node = currentNodes[id];
  if (!node) {
    alert("Node not found: " + id);
    return;
  }
  currentNodeId = id;

  $("node-title").textContent = node.title ?? "";

  // Foreground image (image comes before transients + text)
  const imageEl = $("node-image");
  const imageContainer = $("node-image-container");
  if (node.image) {
    imageEl.src = resolveSrc(node.image);
    imageContainer.style.display = "block";
  } else {
    imageContainer.style.display = "none";
  }

  // Background
  if (node.background) {
    document.body.style.backgroundImage = `url('${resolveSrc(node.background)}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
  } else {
    document.body.style.backgroundImage = '';
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
    // Clear transients after rendering once
    injectedFlavour = null;
    injectedChecks  = null;
    return;
  }

  node.choices.forEach(choice => {
    if (!isChoiceAvailable(choice)) return;

    // === scroll-style button ===
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

    // For checked choices: show an Overall % pill and a hover-reveal with per-stat odds
    if (choice.type === "checked" && Array.isArray(choice.statChecks) && choice.statChecks.length > 0) {
      // Overall % computed from outcome bands (best band by highest lower bound)
      const overall = overallChance(choice.statChecks, choice.outcomes || {});
      const pill = document.createElement("div");
      pill.className = "overall-pill";
      pill.textContent = `Overall ${overall}%`;
      head.appendChild(pill);

      // Optional meta hint
      const meta = document.createElement("div");
      meta.className = "choice-meta";
      meta.textContent = "Hover to view individual checks";

      // Hover-reveal: per-stat percent chips
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
      // Simple choice: just the head (text aligned)
      scroll.appendChild(head);
    }

    // CLICK HANDLER
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

        // Roll each check and record pass/fail for the transient summary
        const rollResults = statChecks.map(sc => {
          const player = getPlayerState(sc.stat) ?? 0;
          const pass   = rollSuccess(player, sc.difficulty);
          return { stat: sc.stat, pass };
        });

        const successes = rollResults.filter(r => r.pass).length;

        const picked = pickOutcome(choice.outcomes || {}, successes);
        if (!picked) {
          alert("No matching outcome for successes = " + successes);
          return;
        }
        const [, outcome] = picked;

        // Apply outcome effects first (if any)
        if (outcome.effects) {
          applyEffects(outcome.effects);
          renderStats();
        }

        // Transients for the NEXT render
        injectedChecks  = rollResults;                              // show only stat + success/fail
        injectedFlavour = (outcome.resultText || "").trim() || null;

        // Navigate (or re-render same node) AFTER setting transients
        if (outcome.next) {
          goToNext(outcome.next);
        } else {
          displayNode(currentNodeId);
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

    choicesContainer.appendChild(scroll);
  });

  // --- event delegation for lightweight hover reveal (no costly reflow) ---
  choicesContainer.onmouseover = (e) => {
    const btn = e.target.closest('.choice-scroll');
    if (btn && choicesContainer.contains(btn)) btn.classList.add('reveal');
  };
  choicesContainer.onmouseout = (e) => {
    const btn = e.target.closest('.choice-scroll');
    if (btn && choicesContainer.contains(btn)) btn.classList.remove('reveal');
  };

  // Clear transients AFTER one render so they don't persist across navigation
  injectedFlavour = null;
  injectedChecks  = null;
}

function goToNext(nextId) {
  if (!nextId) return;
  if (currentNodes[nextId]) {
    displayNode(nextId);
    return;
  }
  const fallbackFile = `events/${String(nextId).replace(/\./g, "-")}.json`;
  fetch(fallbackFile)
    .then(res => {
      if (!res.ok) throw new Error("File not found");
      return res.json();
    })
    .then(newData => {
      newData.forEach(n => { currentNodes[n.id] = n; });
      if (currentNodes[nextId]) {
        displayNode(nextId);
      } else {
        alert("Node not found even after loading file.");
      }
    })
    .catch(() => alert("Failed to load file: " + fallbackFile));
}

/* ---------- FILE PICKER BOOT ---------- */
$("file-input").addEventListener("change", function (event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      currentNodes = {};
      data.forEach(node => { currentNodes[node.id] = node; });
      currentNodeId = data[0]?.id ?? null;
      if (!currentNodeId) throw new Error("No nodes in file");
      displayNode(currentNodeId);
      renderStats();
    } catch (err) {
      alert("Failed to parse JSON file.");
      console.error(err);
    }
  };
  reader.readAsText(file);
});

/* ---------- UI: undersheets from under the main parchment ---------- */
const leftSheet  = document.getElementById("undersheet-left");
const rightSheet = document.getElementById("undersheet-right");

const leftTab  = document.getElementById("tab-left")  || document.querySelector(".pull-left");
const rightTab = document.getElementById("tab-right") || document.querySelector(".pull-right");

leftTab?.addEventListener("click", () => {
  leftSheet?.classList.toggle("open");
});
rightTab?.addEventListener("click", () => {
  rightSheet?.classList.toggle("open");
});

document.querySelectorAll(".under .close-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    const aside = (e.currentTarget).closest(".under");
    aside?.classList.remove("open");
  });
});

/* Tabs inside right sheet */
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
