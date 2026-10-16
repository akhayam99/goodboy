import { useCallback, useMemo, useRef, useState } from 'react';
import type { FilledReport, ListGridColumnsValue } from '../ListGridColumnsContext';
import type { ListGridColumn } from '../listGridTemplate';

type Params = {
  readonly columns: ReadonlyArray<ListGridColumn>;
};

type Registry = {
  readonly rows: Map<string, ReadonlyArray<string>>;
  readonly counts: Map<string, number>;
};

type ShiftParams = {
  readonly counts: Map<string, number>;
  readonly keys: ReadonlyArray<string>;
  readonly step: 1 | -1;
};

const shiftCounts = ({ counts, keys, step }: ShiftParams) => {
  for (const key of keys) {
    const next = (counts.get(key) ?? 0) + step;
    if (next <= 0) {
      counts.delete(key);
      continue;
    }
    counts.set(key, next);
  }
};

const filledKeyOf = (counts: ReadonlyMap<string, number>): string =>
  [...counts.keys()].sort().join('\n');

export const useFilledColumns = ({ columns }: Params): ListGridColumnsValue => {
  const registryRef = useRef<Registry>({ rows: new Map(), counts: new Map() });
  const [filledKey, setFilledKey] = useState('');
  const reportFilled = useCallback(({ rowId, keys }: FilledReport) => {
    const { rows, counts } = registryRef.current;
    shiftCounts({ counts, keys: rows.get(rowId) ?? [], step: -1 });
    rows.delete(rowId);
    if (keys !== null) {
      rows.set(rowId, keys);
      shiftCounts({ counts, keys, step: 1 });
    }
    setFilledKey(filledKeyOf(counts));
  }, []);
  const hasHideable = columns.some((column) => column.shouldHideWhenEmpty === true);
  const hiddenKeys = useMemo(() => {
    const filled = new Set(filledKey === '' ? [] : filledKey.split('\n'));
    return new Set(
      columns
        .filter((column) => column.shouldHideWhenEmpty === true && !filled.has(column.key))
        .map((column) => column.key),
    );
  }, [columns, filledKey]);
  return useMemo(
    () => ({ columns, hiddenKeys, hasHideable, reportFilled }),
    [columns, hiddenKeys, hasHideable, reportFilled],
  );
};
