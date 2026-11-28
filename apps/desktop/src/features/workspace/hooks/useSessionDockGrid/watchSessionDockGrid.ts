import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import {
  DOCK_GRID_MOVE_KEY,
  DOCK_GRID_RECALL_KEY,
  dockGridMoves,
  dockGridOwner,
  dockGridRecalls,
} from '../../../../store/slices/drawer/dockGridWrites';
import { EMPTY_DRAWER_GRID, type DrawerGrid } from '../../../../store/slices/drawer/state';
import { storedDockGridOf } from '../../../../store/slices/drawer/dockGridMemory/storedDockGrid';

export const DOCK_GRID_SAVE_DELAY_MS = 300;

type WatchedStore = {
  readonly getState: () => AppStore;
  readonly subscribe: (listener: (state: AppStore) => void) => () => void;
};

type SessionParams = {
  readonly sessionId: SessionId;
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

export const watchSessionDockGrid = ({
  store,
  delayMs = DOCK_GRID_SAVE_DELAY_MS,
  now = Date.now,
}: Params): (() => void) => {
  const known = new Map<SessionId, string>();
  let pending: PendingSave | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let owner = store.getState().currentSessionId;
  let grid = store.getState().drawerGrid ?? EMPTY_DRAWER_GRID;
  let scope = store.getState().dockScope;
  dockGridOwner.take({ sessionId: owner });

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
        }
      });
  };

  const recall = ({ sessionId }: SessionParams): void => {
    queueMicrotask(() => {
      if (store.getState().currentSessionId !== sessionId) {
        return;
      }
      void store
        .getState()
        .recallDockGrid({ sessionId })
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
      dockGridMoves.cancel({ key: DOCK_GRID_MOVE_KEY });
      flush();
      owner = state.currentSessionId;
      dockGridOwner.take({ sessionId: owner });
      grid = nextGrid;
      if (owner === null) {
        dockGridRecalls.cancel({ key: DOCK_GRID_RECALL_KEY });
        return;
      }
      recall({ sessionId: owner });
      return;
    }
    const isSwap = state.dockScope !== scope;
    scope = state.dockScope;
    if (nextGrid === grid) {
      return;
    }
    grid = nextGrid;
    if (owner === null || isSwap) {
      return;
    }
    pending = { sessionId: owner, grid: nextGrid, at: now() };
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(flush, delayMs);
  });

  const rereadOnFocus = (): void => {
    if (owner === null) {
      return;
    }
    flush();
    recall({ sessionId: owner });
  };
  window.addEventListener('focus', rereadOnFocus);

  return () => {
    window.removeEventListener('focus', rereadOnFocus);
    unsubscribe();
    flush();
    dockGridOwner.take({ sessionId: null });
  };
};
