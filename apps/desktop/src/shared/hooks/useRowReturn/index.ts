import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../../store';
import { stackKey } from '../../../store/slices/navigation/currentStack';

type Params = {
  readonly listKey: string;
  readonly rowIds: ReadonlyArray<string>;
  readonly rowAttribute: string;
};

type RememberParams = {
  readonly rowId: string;
};

export type RowReturn = Readonly<{
  remember: (params: RememberParams) => void;
}>;

export const useRowReturn = ({ listKey, rowIds, rowAttribute }: Params): RowReturn => {
  const amendFocus = useAppStore((state) => state.amendFocus);
  const returnIndex = useAppStore((state) => {
    const stack = state.navigation[stackKey(state)];
    return stack?.entries[stack.index]?.focus.scroll[listKey] ?? null;
  });
  const hasReturned = useRef(false);
  const rowIdsRef = useRef(rowIds);
  rowIdsRef.current = rowIds;
  const returnRowId = returnIndex === null ? null : (rowIds[returnIndex] ?? null);

  useEffect(() => {
    if (hasReturned.current || returnRowId === null) {
      return;
    }
    const row = document.querySelector<HTMLElement>(
      `[${rowAttribute}="${CSS.escape(returnRowId)}"]`,
    );
    if (row === null) {
      return;
    }
    hasReturned.current = true;
    row.scrollIntoView?.({ block: 'center' });
  }, [returnRowId, rowAttribute]);

  const remember = useCallback(
    ({ rowId }: RememberParams): void => {
      const index = rowIdsRef.current.indexOf(rowId);
      if (index < 0) {
        return;
      }
      const state = useAppStore.getState();
      const stack = state.navigation[stackKey(state)];
      const scroll = stack?.entries[stack.index]?.focus.scroll ?? {};
      amendFocus({ patch: { scroll: { ...scroll, [listKey]: index } } });
    },
    [amendFocus, listKey],
  );

  return { remember };
};
