import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import type { SessionFace } from '../../../../store/slices/session-view/types';
import {
  DOCK_GRID_MOVE_KEY,
  DOCK_GRID_RECALL_KEY,
  dockGridMoves,
  dockGridOwner,
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
  readonly face: SessionFace;
  readonly at: number;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

type FaceParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId | null;
};

const faceOf = ({ state, sessionId }: FaceParams): SessionFace =>
  sessionId === null ? 'overview' : (state.sessionFace[sessionId] ?? 'overview');

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
  let face = faceOf({ state: store.getState(), sessionId: owner });
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
    const stored = storedDockGridOf({ grid: job.grid, face: job.face });
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
      dockGridMoves.cancel({ key: DOCK_GRID_MOVE_KEY });
      flush();
      owner = state.currentSessionId;
      dockGridOwner.take({ sessionId: owner });
      grid = nextGrid;
      face = faceOf({ state, sessionId: owner });
      if (owner === null) {
        dockGridRecalls.cancel({ key: DOCK_GRID_RECALL_KEY });
        return;
      }
      recall({ sessionId: owner });
      return;
    }
    const nextFace = faceOf({ state, sessionId: owner });
    if (nextGrid === grid && nextFace === face) {
      return;
    }
    grid = nextGrid;
    face = nextFace;
    if (owner === null) {
      return;
    }
    pending = { sessionId: owner, grid: nextGrid, face: nextFace, at: now() };
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
