import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ExploreChangedView } from '../../../../store/slices/session-view/types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
  readonly isAvailable: boolean;
};

type ChangedOnlyParams = {
  readonly isChangedOnly: boolean;
};

type CollapseParams = {
  readonly path: string;
  readonly isExpanded: boolean;
};

export type ExploreChangedViewState = {
  readonly view: ExploreChangedView;
  readonly isChangedMode: boolean;
  readonly setChangedOnly: (params: ChangedOnlyParams) => void;
  readonly setExpanded: (params: CollapseParams) => void;
};

const NO_COLLAPSED: Readonly<Record<string, boolean>> = Object.freeze({});

const FRESH_VIEW: ExploreChangedView = { mountPath: null, mode: 'all', collapsed: NO_COLLAPSED };

export const useExploreChangedView = ({
  sessionId,
  mountPath,
  isAvailable,
}: Params): ExploreChangedViewState => {
  const storedView = useAppStore((state) => state.exploreChangedView[sessionId] ?? FRESH_VIEW);
  const setExploreChangedView = useAppStore((state) => state.setExploreChangedView);
  const view = storedView.mountPath === mountPath ? storedView : FRESH_VIEW;
  const setChangedOnly = useCallback(
    ({ isChangedOnly }: ChangedOnlyParams) =>
      setExploreChangedView({
        sessionId,
        view: { mountPath, mode: isChangedOnly ? 'changed' : 'all', collapsed: NO_COLLAPSED },
      }),
    [sessionId, mountPath, setExploreChangedView],
  );
  const setExpanded = useCallback(
    ({ path, isExpanded }: CollapseParams) =>
      setExploreChangedView({
        sessionId,
        view: { ...view, mountPath, collapsed: { ...view.collapsed, [path]: !isExpanded } },
      }),
    [sessionId, mountPath, view, setExploreChangedView],
  );
  return {
    view,
    isChangedMode: view.mode === 'changed' && isAvailable,
    setChangedOnly,
    setExpanded,
  };
};
