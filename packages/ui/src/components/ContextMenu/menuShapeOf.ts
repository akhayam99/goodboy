import type { MenuEntry, MenuItemEntry } from './menuTypes';

const MENU_RULE_MIN_ROWS = 5;

const MENU_MIN_ROWS = 2;

type Params = {
  readonly entries: ReadonlyArray<MenuEntry>;
};

type MenuShape = {
  readonly items: ReadonlyArray<MenuItemEntry>;
  readonly isWorthAMenu: boolean;
  readonly hasRules: boolean;
  readonly hasIcons: boolean;
};

export const menuShapeOf = ({ entries }: Params): MenuShape => {
  const items = entries.flatMap((entry): ReadonlyArray<MenuItemEntry> => {
    if (entry.kind === 'item') {
      return [entry];
    }
    return entry.kind === 'group' ? entry.items : [];
  });
  return {
    items,
    isWorthAMenu: items.length >= MENU_MIN_ROWS,
    hasRules: items.length >= MENU_RULE_MIN_ROWS,
    hasIcons: items.length > 0 && items.every((item) => item.icon !== undefined),
  };
};
