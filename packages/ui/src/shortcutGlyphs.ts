type LookupParams = {
  readonly id: string;
};

export type ShortcutGlyphLookup = (params: LookupParams) => string;

type RegisterParams = {
  readonly lookup: ShortcutGlyphLookup;
};

let current: ShortcutGlyphLookup = () => '';

export const registerShortcutGlyphs = ({ lookup }: RegisterParams): void => {
  current = lookup;
};

export const glyphsOfShortcut = ({ id }: LookupParams): string => current({ id });
