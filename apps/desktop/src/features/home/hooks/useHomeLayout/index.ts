import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { READ_FAILED, CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { HOME_WIDGETS, type HomeWidgetId, type WidgetSize } from '../../grid/homeWidgets';
import { DEFAULT_HOME_ENTRIES } from '../../layout/defaultHomeLayout';
import { hideHomeWidget } from '../../layout/hideHomeWidget';
import { HOME_LAYOUT_KEY, type HomeLayout } from '../../layout/layoutTypes';
import { moveHomeWidget } from '../../layout/moveHomeWidget';
import { resizeHomeWidget } from '../../layout/resizeHomeWidget';
import { parseHomeLayout } from '../../layout/parseHomeLayout';
import { serializeHomeLayout } from '../../layout/serializeHomeLayout';
import { showHomeWidget } from '../../layout/showHomeWidget';
import { trayWidgetsOf } from '../../layout/trayWidgetsOf';

const SAVE_DELAY_MS = 300;

type Params = {
  readonly workspaceId: WorkspaceId;
};

type Draft = {
  readonly workspaceId: WorkspaceId;
  readonly entries: HomeLayout;
  readonly revision: number;
};

type Gesture = {
  readonly id: HomeWidgetId;
};

type MoveGesture = {
  readonly id: HomeWidgetId;
  readonly beforeId: HomeWidgetId | null;
};

type ResizeGesture = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
};

type CommitParams = {
  readonly target: WorkspaceId;
  readonly next: HomeLayout;
};

export type HomeLayoutState = {
  readonly entries: HomeLayout;
  readonly tray: ReadonlyArray<HomeWidgetId>;
  readonly isLoaded: boolean;
  readonly isSaveFailed: boolean;
  readonly hide: (params: Gesture) => void;
  readonly show: (params: Gesture) => void;
  readonly move: (params: MoveGesture) => void;
  readonly resize: (params: ResizeGesture) => void;
  readonly retry: () => void;
};

const titleOf = ({ id }: Gesture): string => HOME_WIDGETS[id].title;

export const useHomeLayout = ({ workspaceId }: Params): HomeLayoutState => {
  const raw = useAppStore((state) => state.workspaceValues[workspaceId]?.[HOME_LAYOUT_KEY] ?? null);
  const [loadedFor, setLoadedFor] = useState<WorkspaceId | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [failedFor, setFailedFor] = useState<WorkspaceId | null>(null);
  const workspaceRef = useRef(workspaceId);
  workspaceRef.current = workspaceId;
  const isMountedRef = useRef(true);
  const draftRef = useRef<Draft | null>(null);
  const savedRevisionRef = useRef(0);
  const revisionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sizesRef = useRef(new Map<HomeWidgetId, WidgetSize>());

  const stored = parseHomeLayout({ raw });
  const entries =
    draft !== null && draft.workspaceId === workspaceId
      ? draft.entries
      : (stored ?? DEFAULT_HOME_ENTRIES);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const isLoaded = loadedFor === workspaceId;

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = draftRef.current;
    if (pending === null || pending.revision === savedRevisionRef.current) {
      return;
    }
    const state = useAppStore.getState();
    try {
      await state.saveWorkspaceValue({
        workspaceId: pending.workspaceId,
        key: HOME_LAYOUT_KEY,
        value: serializeHomeLayout({ entries: pending.entries }),
      });
    } catch (error) {
      const isShown = isMountedRef.current && workspaceRef.current === pending.workspaceId;
      if (isShown) {
        setFailedFor(pending.workspaceId);
        return;
      }
      await state.reportError({
        recovery: CHECK_STATE,
        title: "Couldn't save the layout of Home",
        error,
        workspaceId: pending.workspaceId,
      });
      return;
    }
    savedRevisionRef.current = Math.max(savedRevisionRef.current, pending.revision);
    if (draftRef.current?.revision !== pending.revision) {
      return;
    }
    draftRef.current = null;
    if (isMountedRef.current) {
      setDraft(null);
      setFailedFor(null);
    }
  }, []);

  const commit = useCallback(
    ({ target, next }: CommitParams): void => {
      revisionRef.current += 1;
      const written: Draft = { workspaceId: target, entries: next, revision: revisionRef.current };
      draftRef.current = written;
      entriesRef.current = next;
      setDraft(written);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  const show = useCallback(
    ({ id }: Gesture): void => {
      const target = workspaceRef.current;
      const size = sizesRef.current.get(id) ?? HOME_WIDGETS[id].defaultSize;
      const next = showHomeWidget({ entries: entriesRef.current, id, size });
      if (next === null) {
        return;
      }
      commit({ target, next });
      useAppStore.getState().undoable({
        message: `Showing ${titleOf({ id }).toLowerCase()}`,
        isSilent: true,
        isCurrent: () => isMountedRef.current && workspaceRef.current === target,
        undo: async () => {
          const hidden = hideHomeWidget({ entries: entriesRef.current, id });
          if (hidden === null) {
            return false;
          }
          sizesRef.current.set(id, hidden.size);
          commit({ target, next: hidden.entries });
          return true;
        },
      });
    },
    [commit],
  );

  const hide = useCallback(
    ({ id }: Gesture): void => {
      const target = workspaceRef.current;
      const hidden = hideHomeWidget({ entries: entriesRef.current, id });
      if (hidden === null) {
        return;
      }
      sizesRef.current.set(id, hidden.size);
      commit({ target, next: hidden.entries });
      useAppStore.getState().undoable({
        message: `Hidden ${titleOf({ id })}`,
        isCurrent: () => isMountedRef.current && workspaceRef.current === target,
        undo: async () => {
          const restored = showHomeWidget({
            entries: entriesRef.current,
            id,
            size: hidden.size,
            index: hidden.index,
          });
          if (restored === null) {
            return false;
          }
          commit({ target, next: restored });
          return true;
        },
      });
    },
    [commit],
  );

  const move = useCallback(
    ({ id, beforeId }: MoveGesture): void => {
      const target = workspaceRef.current;
      const moved = moveHomeWidget({ entries: entriesRef.current, id, beforeId });
      if (moved === null) {
        return;
      }
      commit({ target, next: moved.entries });
      useAppStore.getState().undoable({
        message: `Moved ${titleOf({ id }).toLowerCase()}`,
        isSilent: true,
        isCurrent: () => isMountedRef.current && workspaceRef.current === target,
        undo: async () => {
          const back = moveHomeWidget({
            entries: entriesRef.current,
            id,
            beforeId: moved.beforeId,
          });
          if (back === null) {
            return false;
          }
          commit({ target, next: back.entries });
          return true;
        },
      });
    },
    [commit],
  );

  const resize = useCallback(
    ({ id, size }: ResizeGesture): void => {
      const target = workspaceRef.current;
      const resized = resizeHomeWidget({ entries: entriesRef.current, id, size });
      if (resized === null) {
        return;
      }
      commit({ target, next: resized.entries });
      useAppStore.getState().undoable({
        message: `Resized ${titleOf({ id }).toLowerCase()}`,
        isSilent: true,
        isCurrent: () => isMountedRef.current && workspaceRef.current === target,
        undo: async () => {
          const back = resizeHomeWidget({
            entries: entriesRef.current,
            id,
            size: resized.previous,
          });
          if (back === null) {
            return false;
          }
          commit({ target, next: back.entries });
          return true;
        },
      });
    },
    [commit],
  );

  const retry = useCallback((): void => {
    void flush();
  }, [flush]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    useAppStore
      .getState()
      .loadWorkspaceValue({ workspaceId, key: HOME_LAYOUT_KEY })
      .then(() => {
        if (isCurrent) {
          setLoadedFor(workspaceId);
        }
      })
      .catch((error: unknown) =>
        useAppStore.getState().reportError({
          recovery: READ_FAILED,
          title: "Couldn't read the layout of Home",
          error,
          severity: 'warning',
          workspaceId,
        }),
      );
    return () => {
      isCurrent = false;
      void flush();
    };
  }, [workspaceId, flush]);

  useEffect(() => {
    const onBlur = () => void flush();
    const onFocus = () => {
      if (draftRef.current !== null) {
        return;
      }
      useAppStore
        .getState()
        .loadWorkspaceValue({ workspaceId: workspaceRef.current, key: HOME_LAYOUT_KEY })
        .catch((error: unknown) =>
          useAppStore.getState().reportError({
            recovery: READ_FAILED,
            title: "Couldn't read the layout of Home",
            error,
            severity: 'warning',
            workspaceId: workspaceRef.current,
          }),
        );
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [flush]);

  return {
    entries,
    tray: trayWidgetsOf({ entries }),
    isLoaded,
    isSaveFailed: failedFor === workspaceId,
    hide,
    show,
    move,
    resize,
    retry,
  };
};
