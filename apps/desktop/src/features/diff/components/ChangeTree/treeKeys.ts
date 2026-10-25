import { treeKeyMove, type TreeKeyRow } from '../../../../shared/utils/treeKeyMove';
import type { TreeRow } from '../../lib/changeTree';

export type TreeKeyAction =
  | { readonly kind: 'cursor'; readonly id: string }
  | { readonly kind: 'fold'; readonly id: string }
  | { readonly kind: 'pick'; readonly id: string }
  | { readonly kind: 'viewed'; readonly id: string };

type Params = {
  readonly key: string;
  readonly rows: ReadonlyArray<TreeRow>;
  readonly cursorId: string | null;
  readonly collapsed: ReadonlySet<string>;
};

type EdgeParams = {
  readonly rows: ReadonlyArray<TreeRow>;
  readonly index: number;
};

type KeyRowParams = {
  readonly row: TreeRow;
  readonly collapsed: ReadonlySet<string>;
};

const keyRowOf = ({ row, collapsed }: KeyRowParams): TreeKeyRow => ({
  id: row.id,
  parentId: row.parentId,
  isBranch: row.kind === 'folder',
  isOpen: row.kind === 'folder' && !collapsed.has(row.id),
});

const cursorAt = ({ rows, index }: EdgeParams): TreeKeyAction | null => {
  const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
  return row === undefined ? null : { kind: 'cursor', id: row.id };
};

export const treeKeyAction = ({ key, rows, cursorId, collapsed }: Params): TreeKeyAction | null => {
  if (rows.length === 0) {
    return null;
  }
  const index = rows.findIndex((row) => row.id === cursorId);
  if (index < 0 && key === 'ArrowDown') {
    return cursorAt({ rows, index: 0 });
  }
  if (index < 0 && key === 'ArrowUp') {
    return cursorAt({ rows, index: rows.length - 1 });
  }
  const move = treeKeyMove({
    key,
    rows: rows.map((row) => keyRowOf({ row, collapsed })),
    activeId: cursorId,
  });
  if (move === null) {
    return key === 'ArrowDown' || key === 'ArrowUp' ? cursorAt({ rows, index }) : null;
  }
  if (move.kind === 'focus') {
    return { kind: 'cursor', id: move.id };
  }
  if (move.kind === 'open' || move.kind === 'close') {
    return { kind: 'fold', id: move.id };
  }
  if (rows[index]?.kind === 'folder') {
    return { kind: 'fold', id: move.id };
  }
  return key === ' ' ? { kind: 'viewed', id: move.id } : { kind: 'pick', id: move.id };
};
