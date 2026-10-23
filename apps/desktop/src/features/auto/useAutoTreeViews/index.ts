import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { liveAutoViewsOf } from '../liveAutoViewsOf';

const NO_VIEWS: ReadonlyArray<AutoTreeView> = [];

type Params = {
  readonly sessionId: SessionId;
};

export const useAutoTreeViews = ({ sessionId }: Params): ReadonlyArray<AutoTreeView> =>
  useAppStore(
    useShallow((state) => {
      const views = state.autoTreeViews[sessionId] ?? NO_VIEWS;
      const agents = state.sessionPhaseRuns[sessionId];
      return agents === undefined ? views : liveAutoViewsOf({ views, agents });
    }),
  );
