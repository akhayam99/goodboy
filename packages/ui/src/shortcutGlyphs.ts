export type ShortcutGlyphLookup = (id: string) => string;

let lookup: ShortcutGlyphLookup = () => '';

export const registerShortcutGlyphs = (next: ShortcutGlyphLookup): void => {
  lookup = next;
};

export const glyphsOfShortcut = (id: string): string => lookup(id);
