import { activeAskBackend } from '../../../features/session/ask/activeAskBackend';
import { sortAskThreads } from './askThreadOrder';
import { showAskThread } from './showAskThread';
import type { AskSessionParams, GetFn, SetFn } from './types';

export const loadAskThreads =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId }: AskSessionParams): Promise<void> => {
    const threads = await activeAskBackend.listThreads({ sessionId });
    const known = get().askThreads[sessionId] ?? [];
    const merged = sortAskThreads([
      ...known.filter((thread) => !threads.some((loaded) => loaded.id === thread.id)),
      ...threads,
    ]);
    set((state) => ({ askThreads: { ...state.askThreads, [sessionId]: merged } }));
    if (get().askThreadId[sessionId] !== undefined) {
      return;
    }
    const newest = merged[0];
    if (newest === undefined) {
      set((state) => ({ askThreadId: { ...state.askThreadId, [sessionId]: null } }));
      return;
    }
    await showAskThread(set, get)({ sessionId, threadId: newest.id });
  };
