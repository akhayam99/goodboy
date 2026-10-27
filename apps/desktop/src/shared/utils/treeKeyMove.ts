export type TreeKeyRow = {
  readonly id: string;
  readonly parentId: string | null;
  readonly isBranch: boolean;
  readonly isOpen: boolean;
};

export type TreeKeyMove = {
  readonly kind: 'focus' | 'open' | 'close' | 'activate';
  readonly id: string;
};

type Params = {
  readonly key: string;
  readonly rows: ReadonlyArray<TreeKeyRow>;
  readonly activeId: string | null;
};

type FocusParams = {
  readonly row: TreeKeyRow | undefined;
};

const focusOn = ({ row }: FocusParams): TreeKeyMove | null =>
  row === undefined ? null : { kind: 'focus', id: row.id };

export const treeKeyMove = ({ key, rows, activeId }: Params): TreeKeyMove | null => {
  if (key === 'Home') {
    return focusOn({ row: rows[0] });
  }
  if (key === 'End') {
    return focusOn({ row: rows[rows.length - 1] });
  }
  const index = rows.findIndex((row) => row.id === activeId);
  const current = rows[index];
  if (current === undefined) {
    return null;
  }
  switch (key) {
    case 'ArrowDown':
      return focusOn({ row: rows[index + 1] });
    case 'ArrowUp':
      return focusOn({ row: rows[index - 1] });
    case 'Enter':
    case ' ':
      return { kind: 'activate', id: current.id };
    case 'ArrowRight': {
      if (!current.isBranch) {
        return null;
      }
      if (!current.isOpen) {
        return { kind: 'open', id: current.id };
      }
      const child = rows[index + 1];
      return child !== undefined && child.parentId === current.id ? focusOn({ row: child }) : null;
    }
    case 'ArrowLeft': {
      if (current.isBranch && current.isOpen) {
        return { kind: 'close', id: current.id };
      }
      return focusOn({ row: rows.find((row) => row.id === current.parentId) });
    }
    default:
      return null;
  }
};
