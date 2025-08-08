export let playerState = {
    nodeId: null,
    fileName: null,
    stats: { strength: 2, dexterity: 3, health: 100 },
    inventory: [],
    flags: {}
};

export function hasRequiredStats(requirements) {
    for (let stat in requirements) {
        if ((playerState.stats[stat] || 0) < requirements[stat]) return false;
    }
    return true;
}

export function hasItems(items) {
    return items.every(item => playerState.inventory.includes(item));
}

export function hasFlags(requiredFlags) {
    for (let flag in requiredFlags) {
        if (playerState.flags[flag] !== requiredFlags[flag]) return false;
    }
    return true;
}

export function applyEffects(effects) {
  if (!effects) return;

  // Stats
  if (effects.stats) {
    for (let stat in effects.stats) {
      playerState.stats[stat] += effects.stats[stat];
    }
  }

  // Inventory
  if (effects.inventoryAdd) {
    for (let item of effects.inventoryAdd) {
      playerState.inventory.push(item);
    }
  }

  // Flags
  if (effects.flags) {
    for (let flag in effects.flags) {
      playerState.flags[flag] = effects.flags[flag];
    }
  }
}

