import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useAppStore } from '../../../store/store';
import { isMainWindow } from '../../workspace/window';
import { isTauriRuntime } from '../../../shared/lib/isTauriRuntime';
import { startPoll } from '../../../shared/lib/usePoll/startPoll';

const WRITER_EVENT = 'worktree_writer_event';
const RECONCILE_INTERVAL_MS = 60_000;

type WriterLeaseEvent = {
  readonly path: string;
  readonly holder: string;
  readonly reason: string;
};

export const startWorktreeWriterBridge = async (): Promise<UnlistenFn> => {
  if (!isTauriRuntime() || !isMainWindow()) {
    return () => undefined;
  }
  const unlisten = await listen<WriterLeaseEvent>(WRITER_EVENT, (event) => {
    void useAppStore.getState().drainResolveWorktree({ worktreePath: event.payload.path });
  });
  void useAppStore.getState().reconcileResolveDrains();
  const stopPoll = startPoll({
    run: () => void useAppStore.getState().reconcileResolveDrains(),
    everyMs: RECONCILE_INTERVAL_MS,
    gate: 'always',
    isImmediate: false,
  });
  return () => {
    stopPoll();
    unlisten();
  };
};
