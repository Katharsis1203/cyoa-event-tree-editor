import type { NodeData, Choice } from "./types";
import { ChoiceEditor } from "./ChoiceEditor";

export function NodeEditor({ node, onChange }:{
  node: NodeData;
  onChange: (patch: Partial<NodeData>) => void;
}) {
  const update = (k: keyof NodeData, v: any) => onChange({ [k]: v });

  const addChoice = () => {
    const next: Choice[] = [...(node.choices ?? []), { type: "simple", text: "", next: "" }];
    update("choices", next);
  };

  const updateChoice = (index: number, patch: Partial<Choice>) => {
    const next = node.choices.slice();
    next[index] = { ...next[index], ...patch } as Choice;
    update("choices", next);
  };

  return (
    <div className="node">
      <div className="row">
        <label>Node ID
          <input value={node.id} onChange={e => update("id", e.target.value)} />
        </label>
        <label>Title
          <input value={node.title ?? ""} onChange={e => update("title", e.target.value)} />
        </label>
      </div>

      <label>Text
        <textarea value={node.text} onChange={e => update("text", e.target.value)} />
      </label>

      <div className="row">
        <label>Image
          <input value={node.image ?? ""} onChange={e => update("image", e.target.value)} />
        </label>
        <label>Background
          <input value={node.background ?? ""} onChange={e => update("background", e.target.value)} />
        </label>
      </div>

      <div className="choices">
        <div className="choices-header">
          <h4>Choices</h4>
          <button onClick={addChoice} type="button">Add Choice</button>
        </div>
        {node.choices?.map((c, i) => (
          <ChoiceEditor key={i} choice={c} onChange={patch => updateChoice(i, patch)} />
        ))}
      </div>
    </div>
  );
}
