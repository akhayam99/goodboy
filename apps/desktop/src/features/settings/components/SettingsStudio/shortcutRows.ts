import { SHORTCUTS, SHORTCUT_FAMILY_LABEL } from '../../../../shared/keyboard/registry';
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
};

export const SHORTCUT_COLUMNS: ReadonlyArray<ReadonlyArray<ShortcutGroup>> = [
  ['general', 'workspaces', 'navigate', 'session'],
  ['views', 'window'],
];

const SHORTCUT_IDS = Object.keys(SHORTCUTS) as ReadonlyArray<ShortcutId>;

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

export const shortcutRows = ({ group }: RowsParams): ReadonlyArray<ShortcutRow> => {
  const ids = SHORTCUT_IDS.filter((id) => SHORTCUTS[id].group === group);
  return ids.flatMap((id, index): ReadonlyArray<ShortcutRow> => {
    const family = familyOf({ id });
    if (family == null) {
      return [{ key: id, label: SHORTCUTS[id].label, first: id, last: id }];
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
      },
    ];
  });
};

export const SHORTCUT_ROW_COUNT = SHORTCUT_COLUMNS.flat().reduce(
  (total, group) => total + shortcutRows({ group }).length,
  0,
);
