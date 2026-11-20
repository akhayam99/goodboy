const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Params = {
  readonly anchor: HTMLElement | null;
  readonly rowSelector: string;
};

type RowsParams = {
  readonly row: Element;
  readonly rowSelector: string;
};

type Neighbours = {
  readonly next: HTMLElement | null;
  readonly previous: HTMLElement | null;
  readonly list: HTMLElement | null;
};

const focusInside = (target: HTMLElement): void => {
  const inner = target.querySelector(FOCUSABLE);
  if (inner instanceof HTMLElement) {
    inner.focus();
    return;
  }
  if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
  }
  target.focus();
};

const LIST = '[role="list"], [role="grid"], [role="listbox"], [role="tree"], ul, ol';

const LANDMARK = 'main, nav, aside, [role="region"], [role="dialog"], body';

const outerListOf = ({ row }: Omit<RowsParams, 'rowSelector'>): HTMLElement | null => {
  const landmark = row.closest(LANDMARK);
  let outer: HTMLElement | null = null;
  let cursor = row.parentElement?.closest<HTMLElement>(LIST) ?? null;
  while (cursor !== null && landmark?.contains(cursor) === true) {
    outer = cursor;
    cursor = cursor.parentElement?.closest<HTMLElement>(LIST) ?? null;
  }
  return outer;
};

const neighboursOf = ({ row, rowSelector }: RowsParams): Neighbours => {
  let scope = outerListOf({ row }) ?? row.parentElement;
  while (scope !== null && scope.querySelectorAll(rowSelector).length < 2) {
    scope = scope.parentElement;
  }
  const rows =
    scope === null
      ? []
      : Array.from(scope.querySelectorAll(rowSelector)).filter(
          (candidate): candidate is HTMLElement =>
            candidate instanceof HTMLElement &&
            candidate.parentElement?.closest(rowSelector) ===
              row.parentElement?.closest(rowSelector),
        );
  const index = rows.findIndex((candidate) => candidate === row);
  return {
    next: index === -1 ? null : (rows[index + 1] ?? null),
    previous: index <= 0 ? null : (rows[index - 1] ?? null),
    list: scope ?? row.parentElement,
  };
};

export const captureReturnFocus = ({ anchor, rowSelector }: Params): (() => void) => {
  const row = anchor?.closest(rowSelector) ?? null;
  if (anchor === null || row === null) {
    return () => undefined;
  }
  const { next, previous, list } = neighboursOf({ row, rowSelector });
  return () => {
    if (anchor.isConnected) {
      return;
    }
    const survivor = [next, previous, list].find(
      (candidate) => candidate !== null && candidate.isConnected,
    );
    if (survivor === undefined || survivor === null) {
      return;
    }
    if (survivor === list) {
      if (!survivor.hasAttribute('tabindex')) {
        survivor.setAttribute('tabindex', '-1');
      }
      survivor.focus();
      return;
    }
    focusInside(survivor);
  };
};
