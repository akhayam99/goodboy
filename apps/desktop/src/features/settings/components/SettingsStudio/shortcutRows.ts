import { SHORTCUTS, SHORTCUT_FAMILY_LABEL } from '../../../../shared/keyboard/registry';
import { SHORTCUT_SCOPE_LABEL } from '../../../../shared/keyboard/shortcutScopeLabel';
import type {
  ShortcutEntry,
  ShortcutFamily,
  ShortcutGroup,
  ShortcutId,
} from '../../../../shared/keyboard/registry';

export type ShortcutRow = {
  readonly key: string;
  readonly label: string;
  readonly first: ShortcutId;
  readonly last: ShortcutId;
  readonly where: string | null;
  readonly also: ShortcutId | null;
};

export const SHORTCUT_COLUMNS: ReadonlyArray<ReadonlyArray<ShortcutGroup>> = [
  ['general', 'workspaces', 'navigate', 'session'],
  ['views', 'lists', 'selection', 'review', 'diff', 'window'],
];

const SHORTCUT_IDS = Object.keys(SHORTCUTS) as ReadonlyArray<ShortcutId>;

const SHARED_ROWS: Readonly<Partial<Record<ShortcutId, ShortcutId>>> = {
  'session.terminal': 'terminal.studio',
};

type FamilyParams = {
  readonly id: ShortcutId;
};

type RowsParams = {
  readonly group: ShortcutGroup;
};

const familyOf = ({ id }: FamilyParams): ShortcutFamily | undefined => {
  const entry: ShortcutEntry = SHORTCUTS[id];
  return entry.family;
};

const whereOf = ({ id }: FamilyParams): string | null => {
  const entry: ShortcutEntry = SHORTCUTS[id];
  return entry.scope === undefined ? null : SHORTCUT_SCOPE_LABEL[entry.scope];
};

const alsoOf = ({ id }: FamilyParams): ShortcutId | null =>
  SHORTCUT_IDS.find((other) => SHARED_ROWS[other] === id) ?? null;

export const groupWhere = ({ group }: RowsParams): string | null => {
  const places = new Set(
    SHORTCUT_IDS.filter((id) => SHORTCUTS[id].group === group).map((id) => whereOf({ id })),
  );
  const [only] = [...places];
  return places.size === 1 ? (only ?? null) : null;
};

export const shortcutRows = ({ group }: RowsParams): ReadonlyArray<ShortcutRow> => {
  const ids = SHORTCUT_IDS.filter(
    (id) => SHORTCUTS[id].group === group && SHARED_ROWS[id] === undefined,
  );
  return ids.flatMap((id, index): ReadonlyArray<ShortcutRow> => {
    const family = familyOf({ id });
    if (family == null) {
      return [
        {
          key: id,
          label: SHORTCUTS[id].label,
          first: id,
          last: id,
          where: whereOf({ id }),
          also: alsoOf({ id }),
        },
      ];
    }
    const previous = ids[index - 1];
    if (previous != null && familyOf({ id: previous }) === family) {
      return [];
    }
    const members = ids.filter((member) => familyOf({ id: member }) === family);
    return [
      {
        key: family,
        label: SHORTCUT_FAMILY_LABEL[family],
        first: id,
        last: members.at(-1) ?? id,
        where: null,
        also: null,
      },
    ];
  });
};

export const SHORTCUT_ROW_COUNT = SHORTCUT_COLUMNS.flat().reduce(
  (total, group) => total + shortcutRows({ group }).length,
  0,
);
