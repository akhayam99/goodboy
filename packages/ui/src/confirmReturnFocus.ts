const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

type KeyOfParams = {
  readonly row: Element;
};

type KeyOf = (params: KeyOfParams) => string | null;

type Params = {
  readonly anchor: HTMLElement | null;
  readonly rowSelector: string;
  readonly keyOf?: KeyOf;
};

type RowsParams = {
  readonly row: Element;
  readonly rowSelector: string;
};

type LiveParams = {
  readonly candidate: HTMLElement | null;
  readonly key: string | null;
  readonly rowSelector: string;
  readonly keyOf: KeyOf | undefined;
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
  const landmark = row.closest(LANDMARK);
  const start = outerListOf({ row }) ?? row.parentElement;
  let scope = start;
  while (scope !== null && scope !== landmark && scope.querySelectorAll(rowSelector).length < 2) {
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
    list: rows.length > 1 ? scope : start,
  };
};

const liveRowOf = ({ candidate, key, rowSelector, keyOf }: LiveParams): HTMLElement | null => {
  if (candidate === null || candidate.isConnected) {
    return candidate;
  }
  if (key === null || keyOf === undefined) {
    return null;
  }
  const found = Array.from(document.querySelectorAll(rowSelector)).find(
    (row) => keyOf({ row }) === key,
  );
  return found instanceof HTMLElement ? found : null;
};

export const captureReturnFocus = ({ anchor, rowSelector, keyOf }: Params): (() => void) => {
  const row = anchor?.closest(rowSelector) ?? null;
  if (anchor === null || row === null) {
    return () => undefined;
  }
  const { next, previous, list } = neighboursOf({ row, rowSelector });
  const nextKey = next === null || keyOf === undefined ? null : keyOf({ row: next });
  const previousKey = previous === null || keyOf === undefined ? null : keyOf({ row: previous });
  return () => {
    if (anchor.isConnected) {
      return;
    }
    const survivor = [
      liveRowOf({ candidate: next, key: nextKey, rowSelector, keyOf }),
      liveRowOf({ candidate: previous, key: previousKey, rowSelector, keyOf }),
    ].find((candidate) => candidate !== null);
    if (survivor !== undefined && survivor !== null) {
      focusInside(survivor);
      return;
    }
    if (list === null || !list.isConnected) {
      return;
    }
    if (!list.hasAttribute('tabindex')) {
      list.setAttribute('tabindex', '-1');
    }
    list.focus();
  };
};
