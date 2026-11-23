import { useEffect, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { dockGridWrites } from '../../../../../store/slices/drawer/dockGridWrites';
import type { OpenDrawer } from '../../../../../store/slices/drawer/state';
import type { LandingMove } from '../../../../../store/slices/navigation/landingOf';
import type { AppState } from '../../../../../store/types';
import { closeDesk } from '../closeDesk';
import { deskToolsOf } from '../deskToolsOf';
import { landOnDesk } from '../landOnDesk';
import { deskLines } from '../useDeskOwner/deskLines';

type Params = {
  readonly sessionId: SessionId;
  readonly next: ReadonlyArray<LandingMove>;
};

type StateParams = {
  readonly state: AppState;
};

const RECALL_WAIT_MS = 2_000;

export const useDeskLanding = ({ sessionId, next }: Params): void => {
  const nextRef = useRef(next);
  nextRef.current = next;

  useEffect(() => {
    let isActive = true;
    let shown: ReadonlyArray<OpenDrawer> = deskToolsOf({ state: useAppStore.getState() });
    const isOnDesk = ({ state }: StateParams): boolean =>
      state.currentSessionId === sessionId && state.sessionFace[sessionId] === 'desk';

    const settle = (): void => {
      if (!isActive) {
        return;
      }
      const state = useAppStore.getState();
      if (!isOnDesk({ state }) || deskToolsOf({ state }).length > 0) {
        return;
      }
      state.setSessionFace({ sessionId, face: 'overview' });
    };

    const unsubscribe = useAppStore.subscribe((state, before) => {
      const isSamePanels =
        state.drawer === before.drawer &&
        state.drawerBack === before.drawerBack &&
        state.drawerGrid === before.drawerGrid;
      if (isSamePanels || !isOnDesk({ state })) {
        return;
      }
      const tools = deskToolsOf({ state });
      if (tools.length > 0) {
        shown = tools;
        return;
      }
      if (shown.length === 0) {
        return;
      }
      const closed = shown;
      shown = [];
      closeDesk({ sessionId, tools: closed });
    });

    const land = (): void => {
      if (isOnDesk({ state: useAppStore.getState() }) && deskLines.takeLanding({ sessionId })) {
        landOnDesk({ sessionId, next: nextRef.current });
      }
    };
    const unlisten = deskLines.subscribe({ listener: land });
    land();
    const timer = setTimeout(settle, RECALL_WAIT_MS);
    void dockGridWrites.run({ key: sessionId, task: async () => undefined }).then(() => {
      clearTimeout(timer);
      settle();
    });

    return () => {
      isActive = false;
      clearTimeout(timer);
      unlisten();
      unsubscribe();
    };
  }, [sessionId]);
};
