import type { RefObject } from 'react';
import type { ListKeyId } from './matchedListKey';

export type RowsParams = {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly rowSelector: string;
};

type Params = {
  readonly event: KeyboardEvent;
  readonly id: ListKeyId;
  readonly rows: RowsParams;
  readonly onSearch: (() => void) | undefined;
};

type RowParams = {
  readonly row: Element;
};

const CONTROL = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
const HIDDEN = '[hidden], [inert], [aria-hidden="true"]';

const controlOfRow = ({ row }: RowParams): HTMLElement | null => {
  if (row.matches(CONTROL) && row instanceof HTMLElement) {
    return row;
  }
  return row.querySelector<HTMLElement>(CONTROL);
};

export const handleRowFocusKey = ({ event, id, rows, onSearch }: Params): void => {
  if (id !== 'list.next' && id !== 'list.previous' && id !== 'list.search') {
    return;
  }
  const container = rows.containerRef.current;
  if (container === null || container.closest(HIDDEN) !== null) {
    return;
  }
  const active = document.activeElement;
  const isInside = active !== null && container.contains(active);
  const isIdle = active === null || active === document.body;
  if (!isInside && !isIdle) {
    return;
  }
  if (id === 'list.search') {
    if (onSearch !== undefined) {
      event.preventDefault();
      onSearch();
    }
    return;
  }
  const controls = [...container.querySelectorAll(rows.rowSelector)].flatMap((row) => {
    const control = controlOfRow({ row });
    return control === null ? [] : [{ unit: row.closest('li') ?? row, control }];
  });
  const index = isInside ? controls.map(({ unit }) => unit.contains(active)).lastIndexOf(true) : -1;
  if (index === -1 && event.key.startsWith('Arrow')) {
    return;
  }
  const step = id === 'list.next' ? 1 : -1;
  const next =
    controls[index === -1 ? 0 : Math.max(0, Math.min(controls.length - 1, index + step))];
  if (next === undefined) {
    return;
  }
  event.preventDefault();
  next.control.focus();
};
