import type { Choice, Outcome, StatCheck } from "./types";
import { useMemo, useRef } from "react";

function nextSuggestedOutcomeKey(
  checksCount: number,
  outcomes?: Record<string, Outcome>
) {
  const existing = new Set(Object.keys(outcomes ?? {}));

  // Try to cover missing numeric slots first: 0..N
  for (let i = 0; i <= Math.max(0, checksCount); i++) {
    const k = String(i);
    if (!existing.has(k)) return k;
  }

  // If all covered, fall back to "N+" or "*" that doesn't collide
  const candidates = [`${checksCount}+`, `*`];
  for (const c of candidates) if (!existing.has(c)) return c;

  // Final fallback: new1, new2, ...
  let i = 1;
  while (existing.has(`new${i}`)) i++;
  return `new${i}`;
}

function ensureUniqueKey(base: string, outcomes: Record<string, Outcome>) {
  if (!outcomes[base]) return base;
  // Append suffixes: "-1", "-2", ...
  let i = 1;
  while (outcomes[`${base}-${i}`]) i++;
  return `${base}-${i}`;
}

function outcomeKeyOrder(a: string, b: string) {
  const num = (k: string) => (/^\d+$/.test(k) ? parseInt(k, 10) : NaN);
  const aNum = num(a),
    bNum = num(b);
  const isPlus = (k: string) => /^\d+\+$/.test(k);
  const isRange = (k: string) => /^\d+-\d+$/.test(k);
  const isStar = (k: string) => k === "*";

  // numbers first
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  if (!isNaN(aNum)) return -1;
  if (!isNaN(bNum)) return 1;

  // then ranges
  if (isRange(a) && isRange(b)) return a.localeCompare(b);
  if (isRange(a)) return -1;
  if (isRange(b)) return 1;

  // then plus
  if (isPlus(a) && isPlus(b)) return a.localeCompare(b);
  if (isPlus(a)) return -1;
  if (isPlus(b)) return 1;

  // "*" last
  if (isStar(a) && isStar(b)) return 0;
  if (isStar(a)) return 1;
  if (isStar(b)) return -1;

  // otherwise alphabetical
  return a.localeCompare(b);
}

export function ChoiceEditor({
  choice,
  onChange,
}: {
  choice: Choice;
  onChange: (patch: Partial<Choice>) => void;
}) {
  const type = (choice as any).type ?? "simple"; // backward-compat default
  const setType = (t: "simple" | "checked") => onChange({ type: t });

  // helpers for checked
  const statChecks = (choice as any).statChecks as StatCheck[] | undefined;
  const outcomes = (choice as any).outcomes as Record<string, Outcome> | undefined;

  // Track last-added key for autofocus UX
  const lastAddedRef = useRef<string | null>(null);

  const addStatCheck = () => {
    onChange({
      statChecks: [...(statChecks ?? []), { stat: "", difficulty: 0 }] as any,
    });
  };
  const updateStatCheck = (idx: number, patch: Partial<StatCheck>) => {
    const next = (statChecks ?? []).slice();
    next[idx] = { ...next[idx], ...patch } as StatCheck;
    onChange({ statChecks: next as any });
  };
  const removeStatCheck = (idx: number) => {
    const next = (statChecks ?? []).slice();
    next.splice(idx, 1);
    onChange({ statChecks: next as any });
  };

  const addOutcome = () => {
    const checksCount = (statChecks ?? []).length;
    const base = nextSuggestedOutcomeKey(checksCount, outcomes);
    const k = ensureUniqueKey(base, outcomes ?? {});
    lastAddedRef.current = k;
    onChange({
      outcomes: {
        ...(outcomes ?? {}),
        [k]: { resultText: "" },
      } as any,
    });
  };

  const updateOutcome = (k: string, patch: Partial<Outcome>) => {
    onChange({
      outcomes: {
        ...(outcomes ?? {}),
        [k]: { ...(outcomes?.[k] ?? {}), ...patch },
      } as any,
    });
  };

  const renameOutcomeKey = (oldKey: string, newKey: string) => {
    if (!outcomes) return;
    const trimmed = (newKey ?? "").trim();
    if (!trimmed || trimmed === oldKey) return;

    const safeKey = outcomes[trimmed] ? ensureUniqueKey(trimmed, outcomes) : trimmed;
    const { [oldKey]: old, ...rest } = outcomes;
    onChange({ outcomes: { ...rest, [safeKey]: old } as any });
  };

  const removeOutcome = (k: string) => {
    if (!outcomes) return;
    const { [k]: _, ...rest } = outcomes;
    onChange({ outcomes: rest as any });
  };

  // tiny validation hints
  const checksCount = (statChecks ?? []).length;
  const suggestedKeys = useMemo(() => {
    if (checksCount === 0) return [];
    return Array.from({ length: checksCount + 1 }, (_, i) => String(i));
  }, [checksCount]);

  // Stable, human-friendly ordering for outcomes
  const outcomeEntries = useMemo(
    () => Object.entries(outcomes ?? {}).sort(([a], [b]) => outcomeKeyOrder(a, b)),
    [outcomes]
  );

  return (
    <div className="choice">
      <label>
        Choice Text
        <input
          value={(choice as any).text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </label>

      <label>
        Choice Type
        <select value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="simple">Simple</option>
          <option value="checked">Checked (stat-based)</option>
        </select>
      </label>

      {type === "simple" && (
        <div className="simple">
          <label>
            Next Node ID
            <input
              value={(choice as any).next ?? ""}
              onChange={(e) => onChange({ next: e.target.value })}
            />
          </label>
        </div>
      )}

      {type === "checked" && (
        <div className="checked">
          <div className="sc-header">
            <h5>Stat Checks (bundle)</h5>
            <button type="button" onClick={addStatCheck}>
              Add Stat Check
            </button>
          </div>

          <div className="sc-list">
            {(statChecks ?? []).map((sc, i) => (
              <div key={i} className="sc-row">
                <input
                  placeholder="stat (e.g. dexterity)"
                  value={sc.stat}
                  onChange={(e) => updateStatCheck(i, { stat: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="difficulty"
                  value={sc.difficulty}
                  onChange={(e) =>
                    updateStatCheck(i, { difficulty: Number(e.target.value) })
                  }
                />
                <button type="button" onClick={() => removeStatCheck(i)}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="out-header">
            <h5>Outcomes (by # successes)</h5>
            {checksCount > 0 && (
              <small>
                Suggested keys: {suggestedKeys.join(", ")} (you can also use 2+, 0-1, *)
              </small>
            )}
            <button type="button" onClick={addOutcome}>
              Add Outcome
            </button>
          </div>

          <div className="out-list">
            {outcomeEntries.map(([k, out]) => (
              <div key={k} className="out-row">
                <div className="row">
                  <input
                    className="key"
                    placeholder="key (e.g. 0, 1, 2+, 0-1, *)"
                    value={k}
                    onChange={(e) => renameOutcomeKey(k, e.target.value)}
                    ref={(el) => {
                      if (el && lastAddedRef.current === k) {
                        el.focus();
                        // move caret to end for convenience
                        const len = el.value.length;
                        try {
                          el.setSelectionRange(len, len);
                        } catch {}
                        lastAddedRef.current = null;
                      }
                    }}
                  />
                  <input
                    className="next"
                    placeholder="next (optional)"
                    value={(out as any).next ?? ""}
                    onChange={(e) => updateOutcome(k, { next: e.target.value })}
                  />
                  <button type="button" onClick={() => removeOutcome(k)}>
                    Remove
                  </button>
                </div>
                {/* ✅ FIXED: proper JSX binding for value */}
                <textarea
                  placeholder="resultText"
                  value={(out as any).resultText ?? ""}
                  onChange={(e) => updateOutcome(k, { resultText: e.target.value })}
                />
                <textarea
                  placeholder='effects (JSON optional)'
                  value={(out as any).effects ? JSON.stringify((out as any).effects) : ""}
                  onChange={(e) => {
                    try {
                      const val = e.target.value.trim();
                      updateOutcome(k, { effects: val ? JSON.parse(val) : undefined });
                    } catch {
                      // ignore parse error in editor
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
