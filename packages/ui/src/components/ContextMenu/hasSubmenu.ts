import type { MenuItemEntry } from './menuTypes';

type Params = {
  readonly entry: MenuItemEntry;
};

export const hasSubmenu = ({ entry }: Params): boolean =>
  (entry.choices != null && entry.choices.length > 0) ||
  (entry.children != null && entry.children.length > 0);
