import type { IsoDateTime, SessionId, TurnState } from '@goodboy/types';
import { turnReducer } from '@goodboy/core';
import { deleteWorktreesForSession, updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { removeWorktree } from '../../../features/worktree/worktree';
import { formatError } from '../../../shared/lib/errors';
import { applySessionUpdate } from '../../session-mutators';
import type { GetFn, SetFn } from './types';

export function endSession(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    if (session.state.kind === 'ended') return;
    if (session.state.kind === 'running') {
      // Best-effort cancel, Rust TurnRegistry may have already removed the
      // run (process exited, app restarted, etc). A "turn not found" error
      // here must not block end-session: the session row is the source of
      // truth, not the in-memory registry.
      await cancelTurn(session.state.runId).catch(() => undefined);
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
