import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { stackKey } from '../../../../store/slices/navigation/currentStack';
import { PLACE_ROWS } from '../../../../store/slices/navigation/placeRows';

export type ChangesMode = 'changed' | 'all';

type Params = {
  readonly sessionId: SessionId;
  readonly mountPath: string;
};

type SetParams = {
  readonly mode: ChangesMode;
};

export type ChangesModeState = {
  readonly mode: ChangesMode;
  readonly setMode: (params: SetParams) => void;
};

const NO_COLLAPSED: Readonly<Record<string, boolean>> = Object.freeze({});

export const useChangesMode = ({ sessionId, mountPath }: Params): ChangesModeState => {
  const stored = useAppStore((state) => state.exploreChangedView[sessionId] ?? null);
  const isAllRequested = useAppStore((state) => {
    const stack = state.navigation[stackKey(state)];
    return stack?.entries[stack.index]?.focus.returnRows?.[PLACE_ROWS.changesMode] === 'all';
  });
  const setExploreChangedView = useAppStore((state) => state.setExploreChangedView);
  const mode: ChangesMode =
    stored !== null && stored.mountPath === mountPath
      ? stored.mode
      : isAllRequested
        ? 'all'
        : 'changed';
  const setMode = useCallback(
    ({ mode: next }: SetParams) =>
      setExploreChangedView({
        sessionId,
        view: { mountPath, mode: next, collapsed: NO_COLLAPSED },
      }),
    [mountPath, sessionId, setExploreChangedView],
  );
  return { mode, setMode };
};
