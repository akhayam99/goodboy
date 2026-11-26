import type { UnlistenFn } from '@tauri-apps/api/event';
import { tauriDatabase } from '../../../shared/lib/db';
import { isTauriRuntime } from '../../../shared/lib/isTauriRuntime';
import { startPoll } from '../../../shared/lib/usePoll/startPoll';
import { useAppStore } from '../../../store/store';
import { isMainWindow } from '../../workspace/window';
import { changedDraftsOf } from './changedDraftsOf';
import { chipsOfState } from './chipsOfState';
import { preloadAskTranscripts } from './preloadAskTranscripts';
import { loadOtherWorkspaceScope } from './loadOtherWorkspaceScope';
import { projectionFieldsOf } from './projectionFieldsOf';
import { publishToBridge } from './publishToBridge';
import { scopeOfState } from './scopeOfState';
import type { WorkspaceScope } from './workspaceScope';

export const PUBLISH_DEBOUNCE_MS = 400;
export const HEARTBEAT_MS = 4000;
export const OTHERS_REFRESH_MS = 20000;

export const startCompanionProjections = async (): Promise<UnlistenFn> => {
  if (!isTauriRuntime() || !isMainWindow()) {
    return () => undefined;
  }
  const epoch = Date.now();
  let seq = 0;
  let others: ReadonlyArray<WorkspaceScope> = [];
  let isPublishing = false;
  let isDirty = false;
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const sent = new Map<string, string>();

  const scopesNow = (): ReadonlyArray<WorkspaceScope> => {
    const state = useAppStore.getState();
    const current = state.workspaces.find((workspace) => workspace.id === state.currentWorkspaceId);
    if (current === undefined) {
      return [];
    }
    const currentId = current.id;
    return [
      scopeOfState({ workspace: current, state, sessions: state.sessions, isFullyLoaded: true }),
      ...others.filter((scope) => scope.workspace.id !== currentId),
    ];
  };

  const publishNow = async (): Promise<void> => {
    if (isPublishing) {
      isDirty = true;
      return;
    }
    isPublishing = true;
    isDirty = false;
    try {
      const now = Date.now();
      const state = useAppStore.getState();
      preloadAskTranscripts({ state });
      const drafts = projectionFieldsOf({
        scopes: scopesNow(),
        detailWorkspaceId: state.currentWorkspaceId,
        chips: chipsOfState({ state, now }),
        now,
      });
      const { changed, removed } = changedDraftsOf({ drafts, sent });
      const nextSeq = changed.length > 0 || removed.length > 0 ? seq + 1 : seq;
      const report = await publishToBridge({ changed, removed, epoch, seq: nextSeq, now });
      for (const rejected of report.rejected) {
        console.error('[companion] projection rejected', rejected.key, rejected.reason);
      }
      seq = nextSeq;
      for (const draft of changed) {
        sent.set(draft.key, JSON.stringify(draft.fields));
      }
      for (const key of removed) {
        sent.delete(key);
      }
    } catch (error) {
      console.error('[companion] projection publish failed', error);
    } finally {
      isPublishing = false;
    }
    if (isDirty) {
      schedule();
    }
  };

  const schedule = (): void => {
    if (debounce !== null) {
      return;
    }
    debounce = setTimeout(() => {
      debounce = null;
      void publishNow();
    }, PUBLISH_DEBOUNCE_MS);
  };

  const refreshOthers = async (): Promise<void> => {
    const state = useAppStore.getState();
    const targets = state.workspaces.filter(
      (workspace) => workspace.id !== state.currentWorkspaceId,
    );
    try {
      others = await Promise.all(
        targets.map((workspace) =>
          loadOtherWorkspaceScope({ db: tauriDatabase, workspace, base: state }),
        ),
      );
      schedule();
    } catch (error) {
      console.error('[companion] other workspaces read failed', error);
    }
  };

  const unsubscribe = useAppStore.subscribe(schedule);
  const stopHeartbeat = startPoll({
    run: () => void publishNow(),
    everyMs: HEARTBEAT_MS,
    gate: 'always',
    isImmediate: false,
  });
  const stopRefresh = startPoll({
    run: () => void refreshOthers(),
    everyMs: OTHERS_REFRESH_MS,
    gate: 'always',
    isImmediate: false,
  });
  void refreshOthers();
  void publishNow();

  return () => {
    unsubscribe();
    stopHeartbeat();
    stopRefresh();
    if (debounce !== null) {
      clearTimeout(debounce);
    }
  };
};
