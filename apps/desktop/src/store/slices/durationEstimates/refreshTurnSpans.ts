import type { GetFn, RefreshTurnSpansParams } from './types';

export const refreshTurnSpans =
  (get: GetFn) =>
  async ({ sessionId, workspaceId }: RefreshTurnSpansParams): Promise<void> => {
    const state = get();
    const reloads: Array<Promise<void>> = [];
    if (state.sessionTurnSpans[sessionId] !== undefined) {
      reloads.push(state.loadSessionTurnSpans({ sessionId }));
    }
    if (state.workspaceDurationHistory[workspaceId] !== undefined) {
      reloads.push(state.loadWorkspaceDurationHistory({ workspaceId }));
    }
    await Promise.all(reloads);
  };
