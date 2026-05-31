import type { IsoDateTime, ProviderRunId, SessionId, TurnState } from '@goodboy/types';
import { turnReducer } from '@goodboy/core';
import { deleteWorktreesForSession, updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { removeWorktree } from '../../../features/worktree/worktree';
import { formatError } from '../../../shared/lib/errors';
import { applySessionUpdate, cancelledRunIds } from '../../session-mutators';
import type { GetFn, SetFn } from './types';

export function endSession(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    if (session.state.kind === 'ended') return;
    const toCancel = new Set<ProviderRunId>();
    if (session.state.kind === 'running') toCancel.add(session.state.runId);
    const turnStates = get().agentTurnState;
    for (const agent of get().sessionPhaseRuns[sessionId] ?? []) {
      const st = turnStates[agent.id];
      if (st?.kind === 'running') toCancel.add(st.runId);
    }
    for (const rid of toCancel) {
      cancelledRunIds.add(rid);
      await cancelTurn(rid).catch(() => undefined);
    }

    const worktreePaths = get().sessionWorktrees[sessionId] ?? [];
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (workspace) {
      for (const worktreePath of worktreePaths) {
        try {
          await removeWorktree(workspace.rootPath, worktreePath);
        } catch (err) {
          // worktree may already be gone, surface as warning, continue ending
          console.warn(`worktree_remove failed: ${formatError(err)}`);
        }
      }
    }
    await deleteWorktreesForSession(tauriDatabase, sessionId);

    const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;
    const ended: TurnState = turnReducer(session.state, { kind: 'end', at: now() });
    await updateSessionState(tauriDatabase, sessionId, ended, now());
    const allAgents = get().sessionPhaseRuns[sessionId] ?? [];
    set((state) => {
      const next = { ...state.agentTurnState };
      for (const agent of allAgents) next[agent.id] = ended;
      return { agentTurnState: next };
    });
    applySessionUpdate(set, sessionId, ended);

    set((state) => {
      const nextWorktrees = { ...state.sessionWorktrees };
      delete nextWorktrees[sessionId];
      const nextBranches = { ...state.sessionBranches };
      delete nextBranches[sessionId];
      return { sessionWorktrees: nextWorktrees, sessionBranches: nextBranches };
    });
  };
}
