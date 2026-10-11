import { entryRowsOf, type ExploreEntryRow, type ExploreRow } from './exploreRows';

export type ExploreKeyResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'focus'; readonly id: string }
  | { readonly kind: 'setExpanded'; readonly path: string; readonly isExpanded: boolean }
  | { readonly kind: 'activate'; readonly id: string };

type Params = {
  readonly rows: ReadonlyArray<ExploreRow>;
  readonly activeId: string | null;
  readonly key: string;
};

const NONE: ExploreKeyResult = { kind: 'none' };

type FocusParams = {
  readonly row: ExploreEntryRow | undefined;
};

const focusOn = ({ row }: FocusParams): ExploreKeyResult =>
  row === undefined ? NONE : { kind: 'focus', id: row.id };

export const exploreTreeKey = ({ rows, activeId, key }: Params): ExploreKeyResult => {
  const entries = entryRowsOf(rows);
  if (entries.length === 0) {
    return NONE;
  }
  if (key === 'Home') {
    return focusOn({ row: entries[0] });
  }
  if (key === 'End') {
    return focusOn({ row: entries[entries.length - 1] });
  }
  const index = entries.findIndex((row) => row.id === activeId);
  const current = entries[index];
  if (current === undefined) {
    return key === 'ArrowDown' || key === 'ArrowUp' ? focusOn({ row: entries[0] }) : NONE;
  }
  if (key === 'ArrowDown') {
    return focusOn({ row: entries[index + 1] });
  }
  if (key === 'ArrowUp') {
    return focusOn({ row: entries[index - 1] });
  }
  if (key === 'Enter' || key === ' ') {
    return { kind: 'activate', id: current.id };
  }
  if (key === 'ArrowRight') {
    if (!current.entry.isDir) {
      return NONE;
    }
    if (!current.isExpanded) {
      return { kind: 'setExpanded', path: current.entry.relPath, isExpanded: true };
    }
    const next = entries[index + 1];
    return next !== undefined && next.parentPath === current.entry.relPath
      ? focusOn({ row: next })
      : NONE;
  }
  if (key === 'ArrowLeft') {
    if (current.entry.isDir && current.isExpanded) {
      return { kind: 'setExpanded', path: current.entry.relPath, isExpanded: false };
    }
    return focusOn({ row: entries.find((row) => row.entry.relPath === current.parentPath) });
  }
  return NONE;
};
