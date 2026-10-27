import type { ShortcutEntry } from '../registry';

type Params = {
  readonly first: ShortcutEntry;
  readonly second: ShortcutEntry;
};

export const scopesOverlap = ({ first, second }: Params): boolean =>
  first.scope === undefined || second.scope === undefined || first.scope === second.scope;
