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

export const treeKeyAction = ({ key, rows, cursorId, collapsed }: Params): TreeKeyAction | null => {
  if (rows.length === 0) {
    return null;
  }
  const index = rows.findIndex((row) => row.id === cursorId);
  const current = rows[index];
  const at = (next: number): TreeKeyAction | null => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, next))];
    return row === undefined ? null : { kind: 'cursor', id: row.id };
  };
  switch (key) {
    case 'ArrowDown':
      return at(index < 0 ? 0 : index + 1);
    case 'ArrowUp':
      return at(index < 0 ? rows.length - 1 : index - 1);
    case 'Home':
      return at(0);
    case 'End':
      return at(rows.length - 1);
    case 'ArrowRight':
      if (current === undefined || current.kind !== 'folder') {
        return null;
      }
      return collapsed.has(current.id) ? { kind: 'fold', id: current.id } : at(index + 1);
    case 'ArrowLeft': {
      if (current === undefined) {
        return null;
      }
      if (current.kind === 'folder' && !collapsed.has(current.id)) {
        return { kind: 'fold', id: current.id };
      }
      return current.parentId === null ? null : { kind: 'cursor', id: current.parentId };
    }
    case 'Enter':
      if (current === undefined) {
        return null;
      }
      return current.kind === 'folder'
        ? { kind: 'fold', id: current.id }
        : { kind: 'pick', id: current.id };
    case ' ':
      if (current === undefined) {
        return null;
      }
      return current.kind === 'folder'
        ? { kind: 'fold', id: current.id }
        : { kind: 'viewed', id: current.id };
    default:
      return null;
  }
};
