export type Effect = {
  stats?: Record<string, number>;
  flags?: Record<string, boolean>;
  inventoryAdd?: string[];
  inventoryRemove?: string[];
};

export type Outcome = {
  resultText?: string;
  effects?: Effect;
  next?: string; // auto-advance
  choices?: { text: string; next: string }[]; // show new choices inline
};

export type StatCheck = { stat: string; difficulty: number };

export type SimpleChoice = {
  type?: "simple"; // undefined => treat as simple for backward-compat
  text: string;
  next?: string;
  node?: NodeData; // inline auth
};

export type CheckedChoice = {
  type: "checked";
  text: string;
  statChecks: StatCheck[];                 // multiple rolls
  outcomes: Record<string, Outcome>;       // keys: "0", "1", "2+", "0-1", "*"
  node?: NodeData; // inline auth
};

export type Choice = SimpleChoice | CheckedChoice;

export type NodeData = {
  id: string;
  title?: string;
  text: string;
  image?: string;
  background?: string;
  choices: Choice[];
};
