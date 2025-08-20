import React, { useMemo, useRef, useState } from "react";
import { NodeEditor } from "./NodeEditor";
import type { NodeData, Choice } from "./types";
import "./index.css";

function isArrayOfNodes(x: any): x is NodeData[] {
  return Array.isArray(x) && x.every(n => n && typeof n.id === "string" && Array.isArray(n.choices));
}

export default function App() {
  const [nodes, setNodes] = useState<NodeData[]>(() => []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => nodes.find(n => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  // --- Node ops ---
  const addNode = () => {
    // generate a unique id like "node_1"
    let i = nodes.length + 1;
    let id = `node_${i}`;
    const ids = new Set(nodes.map(n => n.id));
    while (ids.has(id)) { i += 1; id = `node_${i}`; }
    const newNode: NodeData = {
      id,
      title: "",
      text: "",
      image: "",
      background: "",
      choices: [] as Choice[],
    } as any;
    setNodes(prev => [...prev, newNode]);
    setSelectedId(id);
  };

  const duplicateNode = (id: string) => {
    const base = nodes.find(n => n.id === id);
    if (!base) return;
    // shallow clone with new id
    let i = 1;
    let newId = `${id}_copy`;
    const ids = new Set(nodes.map(n => n.id));
    while (ids.has(newId)) { i += 1; newId = `${id}_copy${i}`; }
    const copy: NodeData = JSON.parse(JSON.stringify({ ...base, id: newId }));
    setNodes(prev => [...prev, copy]);
    setSelectedId(newId);
  };

  const deleteNode = (id: string) => {
    const next = nodes.filter(n => n.id !== id);
    setNodes(next);
    if (selectedId === id) {
      setSelectedId(next.length ? next[0].id : null);
    }
  };

  const updateSelected = (patch: Partial<NodeData>) => {
    if (!selected) return;
    setNodes(prev =>
      prev.map(n => (n.id === selected.id ? ({ ...n, ...patch }) as NodeData : n))
    );
    // allow renaming id and keep selection on it
    if (patch.id && patch.id !== selected.id) {
      setSelectedId(patch.id);
    }
  };

  // --- Import / Export ---
  const onImportClick = () => fileInputRef.current?.click();

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (isArrayOfNodes(json)) {
        setNodes(json);
        setSelectedId(json[0]?.id ?? null);
      } else {
        alert("Import failed: expected an array of nodes.");
      }
    } catch (err) {
      alert("Import failed: invalid JSON.");
    } finally {
      e.currentTarget.value = "";
    }
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify(nodes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = "story-events.json";
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sidebar filtering
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter(n =>
      n.id.toLowerCase().includes(q) ||
      (n.title ?? "").toLowerCase().includes(q) ||
      (n.text ?? "").toLowerCase().includes(q)
    );
  }, [nodes, query]);

  return (
    <div className="app">
      <h1>Event Chain Editor</h1>

      <div className="toolbar">
        <div className="import">
          <button type="button" onClick={onImportClick}>Import JSON</button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
        </div>
        <button type="button" onClick={onExport}>Export JSON</button>
        <button type="button" onClick={addNode}>Add Node</button>
        {selected && (
          <>
            <button type="button" onClick={() => duplicateNode(selected.id)}>Duplicate Node</button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete node "${selected.id}"?`)) deleteNode(selected.id);
              }}
            >
              Delete Node
            </button>
          </>
        )}
      </div>

      <div className="shell">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-head">
            <input
              className="search"
              placeholder="Search nodes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="node-list">
            {filtered.map(n => {
              const isSel = n.id === selectedId;
              return (
                <button
                  key={n.id}
                  className={`node-item ${isSel ? "selected" : ""}`}
                  onClick={() => setSelectedId(n.id)}
                  title={n.title || n.id}
                >
                  <div className="node-item-id">{n.id}</div>
                  {n.title ? <div className="node-item-title">{n.title}</div> : null}
                  <div className="node-item-meta">
                    <span>{(n.choices?.length ?? 0)} choice{(n.choices?.length ?? 0) === 1 ? "" : "s"}</span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="sidebar-empty">No nodes match your search.</div>
            )}
          </div>
        </aside>

        {/* Main editor panel */}
        <main className="mainpane">
          {!selected ? (
            <div className="empty-state">
              <p>Select a node from the left, or <button className="linklike" onClick={addNode}>create a new node</button>.</p>
            </div>
          ) : (
            <NodeEditor node={selected} onChange={updateSelected} />
          )}
        </main>
      </div>
    </div>
  );
}
