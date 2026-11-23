import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { AppState } from '../../../../../store/types';
import { deskToolsOf } from '../deskToolsOf';
import { isFaceShown } from '../../../desk/isFaceShown';
import { switchSessionFace } from '../switchSessionFace';

type Params = {
  readonly sessionId: SessionId;
};

type StateParams = Params & {
  readonly state: AppState;
};

const isOverviewShown = ({ state, sessionId }: StateParams): boolean =>
  state.currentSessionId === sessionId &&
  (state.sessionFace[sessionId] ?? 'overview') === 'overview' &&
  isFaceShown({ state, sessionId });

export const useDeskFollowsTools = ({ sessionId }: Params): void => {
  useEffect(() => {
    let count = 0;
    const follow = ({ state }: Pick<StateParams, 'state'>): void => {
      const next = deskToolsOf({ state }).length;
      const hasOpened = next > count;
      count = next;
      if (hasOpened && isOverviewShown({ state, sessionId })) {
        switchSessionFace({ sessionId, face: 'desk' });
      }
    };
    follow({ state: useAppStore.getState() });
    return useAppStore.subscribe((state, before) => {
      const isSamePanels =
        state.drawer === before.drawer &&
        state.drawerBack === before.drawerBack &&
        state.drawerGrid === before.drawerGrid;
      if (!isSamePanels) {
        follow({ state });
      }
    });
  }, [sessionId]);
};
