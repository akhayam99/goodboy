import { SHORTCUTS, shortcutRangeGlyphs, type ShortcutId } from '../../../shared/keyboard/registry';
import { queryWordsOf } from '../../../features/settings/components/GuideStudio/queryWordsOf';
import {
  SHORTCUT_COLUMNS,
  shortcutRows,
  type ShortcutRow,
} from '../../../features/settings/components/SettingsStudio/shortcutRows';

export type ShortcutHit = {
  readonly key: string;
  readonly label: string;
  readonly glyphs: string;
};

type TextParams = {
  readonly row: ShortcutRow;
};

const SHORTCUT_ALIASES: Readonly<Partial<Record<ShortcutId, string>>> = {
  'palette.open': 'command palette',
};

const keyTextOf = ({ row }: TextParams): string => {
  const ids: ReadonlyArray<ShortcutId> = [row.first, row.last];
  const combos = ids.map((id) => SHORTCUTS[id].combo).join(' ');
  const aliases = ids.map((id) => SHORTCUT_ALIASES[id] ?? '').join(' ');
  return `${row.label} ${shortcutRangeGlyphs({ first: row.first, last: row.last })} ${combos} ${aliases}`.toLowerCase();
};

type Params = {
  readonly query: string;
};

export const searchShortcuts = ({ query }: Params): ReadonlyArray<ShortcutHit> => {
  const words = queryWordsOf({ query });
  if (words.length === 0) {
    return [];
  }
  return SHORTCUT_COLUMNS.flat()
    .flatMap((group) => shortcutRows({ group }))
    .filter((row) => {
      const text = keyTextOf({ row });
      return words.every((word) => text.includes(word));
    })
    .map((row) => ({
      key: row.key,
      label: row.label,
      glyphs: shortcutRangeGlyphs({ first: row.first, last: row.last }),
    }));
};
