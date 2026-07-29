import { useCallback, useRef, useState, type MouseEvent } from 'react';

type MultiSelectClickEvent = Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

export type MultiSelect<T extends string> = {
  readonly selected: ReadonlyArray<T>;
  readonly isSelected: (id: T) => boolean;
  readonly toggle: (id: T) => void;
  readonly selectRange: (id: T) => void;
  readonly selectAll: () => void;
  readonly clear: () => void;
  readonly handleItemClick: (id: T, event: MultiSelectClickEvent) => void;
};

export const useMultiSelect = <T extends string>(orderedIds: ReadonlyArray<T>): MultiSelect<T> => {
  const [selected, setSelected] = useState<ReadonlyArray<T>>([]);
  const anchorRef = useRef<T | null>(null);
  const baseRef = useRef<ReadonlyArray<T>>([]);
  const orderRef = useRef(orderedIds);
  orderRef.current = orderedIds;

  const isSelected = useCallback((id: T) => selected.includes(id), [selected]);

  const toggle = useCallback((id: T) => {
    anchorRef.current = id;
    setSelected((current) => {
      const next = current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id];
      baseRef.current = next;
      return next;
    });
  }, []);

  const selectRange = useCallback((id: T) => {
    const order = orderRef.current;
    const anchor = anchorRef.current;
    const to = order.indexOf(id);
    const from = anchor == null ? -1 : order.indexOf(anchor);
    if (to < 0 || from < 0) {
      anchorRef.current = id;
      baseRef.current = [id];
      setSelected([id]);
      return;
    }
    const range = order.slice(Math.min(from, to), Math.max(from, to) + 1);
    setSelected([...baseRef.current.filter((entry) => !range.includes(entry)), ...range]);
  }, []);

  const selectAll = useCallback(() => {
    const order = orderRef.current;
    anchorRef.current = order[0] ?? null;
    baseRef.current = [...order];
    setSelected([...order]);
  }, []);

  const clear = useCallback(() => {
    anchorRef.current = null;
    baseRef.current = [];
    setSelected([]);
  }, []);

  const handleItemClick = useCallback(
    (id: T, event: MultiSelectClickEvent) => {
      if (event.shiftKey) {
        selectRange(id);
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        toggle(id);
        return;
      }
      anchorRef.current = id;
      baseRef.current = [id];
      setSelected([id]);
    },
    [selectRange, toggle],
  );

  return { selected, isSelected, toggle, selectRange, selectAll, clear, handleItemClick };
};
