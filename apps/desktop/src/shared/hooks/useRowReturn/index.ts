import { useCallback, useEffect, useRef } from 'react';
import { appScrollIntoView } from '@goodboy/ui';
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
  returnRowId: string | null;
}>;

type ResolveParams = {
  readonly rowIds: ReadonlyArray<string>;
  readonly savedRowId: string | null;
  readonly savedIndex: number | null;
};

const returnRowOf = ({ rowIds, savedRowId, savedIndex }: ResolveParams): string | null => {
  if (savedRowId !== null && rowIds.includes(savedRowId)) {
    return savedRowId;
  }
  if (savedIndex === null) {
    return null;
  }
  return rowIds[savedIndex] ?? null;
};

export const useRowReturn = ({ listKey, rowIds, rowAttribute }: Params): RowReturn => {
  const amendFocus = useAppStore((state) => state.amendFocus);
  const savedIndex = useAppStore((state) => {
    const stack = state.navigation[stackKey(state)];
    return stack?.entries[stack.index]?.focus.scroll[listKey] ?? null;
  });
  const savedRowId = useAppStore((state) => {
    const stack = state.navigation[stackKey(state)];
    return stack?.entries[stack.index]?.focus.returnRows?.[listKey] ?? null;
  });
  const hasReturned = useRef(false);
  const rowIdsRef = useRef(rowIds);
  rowIdsRef.current = rowIds;
  const returnRowId = returnRowOf({ rowIds, savedRowId, savedIndex });

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
    appScrollIntoView({ element: row, block: 'center' });
  });

  const remember = useCallback(
    ({ rowId }: RememberParams): void => {
      const index = rowIdsRef.current.indexOf(rowId);
      if (index < 0) {
        return;
      }
      hasReturned.current = false;
      const state = useAppStore.getState();
      const stack = state.navigation[stackKey(state)];
      const focus = stack?.entries[stack.index]?.focus;
      amendFocus({
        patch: {
          scroll: { ...focus?.scroll, [listKey]: index },
          returnRows: { ...focus?.returnRows, [listKey]: rowId },
        },
      });
    },
    [amendFocus, listKey],
  );

  return { remember, returnRowId };
};
