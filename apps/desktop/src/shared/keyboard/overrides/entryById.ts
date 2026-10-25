import { SHORTCUTS, type ShortcutEntry } from '../registry';

export const entryById = new Map<string, ShortcutEntry>(Object.entries(SHORTCUTS));
