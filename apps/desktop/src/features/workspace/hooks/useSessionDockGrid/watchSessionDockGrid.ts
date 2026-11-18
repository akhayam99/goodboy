import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import {
  DOCK_GRID_RECALL_KEY,
  dockGridRecalls,
} from '../../../../store/slices/drawer/dockGridWrites';
import { EMPTY_DRAWER_GRID, type DrawerGrid } from '../../../../store/slices/drawer/state';
import { storedDockGridOf } from '../../../../store/slices/drawer/storedDockGrid';

export const DOCK_GRID_SAVE_DELAY_MS = 300;

type WatchedStore = {
  readonly getState: () => AppStore;
  readonly subscribe: (listener: (state: AppStore) => void) => () => void;
};

type Params = {
  readonly store: WatchedStore;
  readonly delayMs?: number;
  readonly now?: () => number;
};

type PendingSave = {
  readonly sessionId: SessionId;
  readonly grid: DrawerGrid;
  readonly at: number;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

export const watchSessionDockGrid = ({
  store,
  delayMs = DOCK_GRID_SAVE_DELAY_MS,
  now = Date.now,
}: Params): (() => void) => {
  const known = new Map<SessionId, string>();
  const savedThisRun = new Set<SessionId>();
  let pending: PendingSave | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let owner = store.getState().currentSessionId;
  let grid = store.getState().drawerGrid ?? EMPTY_DRAWER_GRID;

  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const job = pending;
    pending = null;
    if (job === null) {
      return;
    }
    const stored = storedDockGridOf({ grid: job.grid });
    if (known.get(job.sessionId) === stored) {
      return;
    }
    void store
      .getState()
      .rememberDockGrid({ sessionId: job.sessionId, stored, savedAt: job.at })
      .then((isSaved) => {
        if (isSaved) {
          known.set(job.sessionId, stored);
          savedThisRun.add(job.sessionId);
        }
      });
  };

  const recall = ({ sessionId }: SessionParams): void => {
    queueMicrotask(() => {
      void store
        .getState()
        .recallDockGrid({ sessionId, isSavedThisRun: savedThisRun.has(sessionId) })
        .then((stored) => {
          if (stored !== null) {
            known.set(sessionId, stored);
          }
        });
    });
  };

  if (owner !== null) {
    recall({ sessionId: owner });
  }

  const unsubscribe = store.subscribe((state) => {
    const nextGrid = state.drawerGrid ?? EMPTY_DRAWER_GRID;
    if (state.currentSessionId !== owner) {
      flush();
      owner = state.currentSessionId;
      grid = nextGrid;
      if (owner === null) {
        dockGridRecalls.cancel({ key: DOCK_GRID_RECALL_KEY });
        return;
      }
      recall({ sessionId: owner });
      return;
    }
    if (nextGrid === grid) {
      return;
    }
    grid = nextGrid;
    if (owner === null) {
      return;
    }
    pending = { sessionId: owner, grid: nextGrid, at: now() };
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(flush, delayMs);
  });

  return () => {
    unsubscribe();
    flush();
  };
};
