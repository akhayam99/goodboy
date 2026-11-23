import { useCallback, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { currentStack, stackKey } from '../../../../../store/slices/navigation/currentStack';
import { PLACE_ROWS } from '../../../../../store/slices/navigation/placeRows';
import type { AppState } from '../../../../../store/types';

export type BoardLayout = 'queue' | 'stages';

type RowKey = (typeof PLACE_ROWS)['boardLayout' | 'boardMove'];

type RowParams = {
  readonly state: AppState;
  readonly key: RowKey;
};

const boardRowOf = ({ state, key }: RowParams): string | null | undefined => {
  const stack = state.navigation[stackKey(state)];
  const entry = stack?.entries[stack.index];
  if (entry === undefined || entry.place.at !== 'board') {
    return undefined;
  }
  return entry.focus.returnRows?.[key] ?? null;
};

type SetRowParams = {
  readonly key: RowKey;
  readonly value: string;
};

type LayoutParams = {
  readonly layout: BoardLayout;
};

type MoveParams = {
  readonly moveId: string;
};

export type BoardPage = Readonly<{
  layout: BoardLayout;
  focusedMoveId: string | null;
  setLayout: (params: LayoutParams) => void;
  setFocusedMove: (params: MoveParams) => void;
}>;

export const useBoardPage = (): BoardPage => {
  const layoutRow = useAppStore((state) => boardRowOf({ state, key: PLACE_ROWS.boardLayout }));
  const moveRow = useAppStore((state) => boardRowOf({ state, key: PLACE_ROWS.boardMove }));
  const [keptLayout, setKeptLayout] = useState<string | null>(layoutRow ?? null);
  const [focusedMoveId, setKeptMove] = useState<string | null>(moveRow ?? null);
  if (layoutRow !== undefined && layoutRow !== keptLayout) {
    setKeptLayout(layoutRow);
  }
  if (moveRow !== undefined && moveRow !== focusedMoveId) {
    setKeptMove(moveRow);
  }
  const amendFocus = useAppStore((state) => state.amendFocus);
  const setRow = useCallback(
    ({ key, value }: SetRowParams) => {
      const stack = currentStack(useAppStore.getState());
      const entry = stack.entries[stack.index];
      if (entry === undefined || entry.place.at !== 'board') {
        return;
      }
      if (entry.focus.returnRows?.[key] === value) {
        return;
      }
      amendFocus({ patch: { returnRows: { ...entry.focus.returnRows, [key]: value } } });
    },
    [amendFocus],
  );
  const setLayout = useCallback(
    ({ layout }: LayoutParams) => setRow({ key: PLACE_ROWS.boardLayout, value: layout }),
    [setRow],
  );
  const setFocusedMove = useCallback(
    ({ moveId }: MoveParams) => setRow({ key: PLACE_ROWS.boardMove, value: moveId }),
    [setRow],
  );
  return {
    layout: keptLayout === 'stages' ? 'stages' : 'queue',
    focusedMoveId,
    setLayout,
    setFocusedMove,
  };
};
