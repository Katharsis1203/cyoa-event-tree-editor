import { hasRequiredStats, hasItems, hasFlags } from './player.js';

export function isChoiceAvailable(choice) {
    const req = choice.requires;
    if (!req) return true;

    if (req.stats && !hasRequiredStats(req.stats)) return false;
    if (req.inventory && !hasItems(req.inventory)) return false;
    if (req.flags && !hasFlags(req.flags)) return false;

    return true;
}