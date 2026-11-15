import { useCallback, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { stackKey } from '../../../../../store/slices/navigation/currentStack';
import { PLACE_ROWS } from '../../../../../store/slices/navigation/placeRows';

type Params = {
  readonly aloneRowId: string | null;
};

type RowParams = {
  readonly rowId: string;
};

export type OpenRows = Readonly<{
  openIds: ReadonlySet<string>;
  toggle: (params: RowParams) => void;
}>;

export const useOpenRows = ({ aloneRowId }: Params): OpenRows => {
  const amendFocus = useAppStore((state) => state.amendFocus);
  const savedRowId = useAppStore((state) => {
    const stack = state.navigation[stackKey(state)];
    return stack?.entries[stack.index]?.focus.returnRows?.[PLACE_ROWS.boardRow] ?? null;
  });
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => {
    if (savedRowId !== null) {
      return new Set([savedRowId]);
    }
    return aloneRowId === null ? new Set() : new Set([aloneRowId]);
  });
  const toggle = useCallback(
    ({ rowId }: RowParams) => {
      const state = useAppStore.getState();
      const stack = state.navigation[stackKey(state)];
      const kept = stack?.entries[stack.index]?.focus.returnRows ?? {};
      const rest = Object.fromEntries(
        Object.entries(kept).filter(([key]) => key !== PLACE_ROWS.boardRow),
      );
      if (openIds.has(rowId)) {
        setOpenIds(new Set([...openIds].filter((id) => id !== rowId)));
        amendFocus({ patch: { returnRows: rest } });
        return;
      }
      setOpenIds(new Set([...openIds, rowId]));
      amendFocus({ patch: { returnRows: { ...rest, [PLACE_ROWS.boardRow]: rowId } } });
    },
    [amendFocus, openIds],
  );
  return { openIds, toggle };
};
