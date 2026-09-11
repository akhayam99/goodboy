import { PREFIXES, type PrefixMeta, type QuickActionGroup } from '../../../quick-actions/grammar';

export type PaletteGroup = Exclude<QuickActionGroup, 'skill' | 'workflow'>;

export const PALETTE_PREFIXES: ReadonlyArray<PrefixMeta> = PREFIXES.filter(
  (prefix) => prefix.group !== 'skill' && prefix.group !== 'workflow',
);

type PlaceholderParams = {
  readonly prefix: PrefixMeta | null;
};

export const palettePlaceholder = ({ prefix }: PlaceholderParams): string => {
  if (prefix !== null) {
    return `Search ${prefix.hint}…`;
  }
  const symbols = PALETTE_PREFIXES.map((entry) => entry.symbol).join(' ');
  return `Search anything, or type ${symbols} to filter`;
};
