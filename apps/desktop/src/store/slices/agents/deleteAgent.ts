import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { purgeAgentForDelete, updateSessionState } from '@goodboy/db';
import { removeQuestionsFromSlot } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { deriveSessionState, purgedAgentIds } from '../sessions/sessionMutators';
import { dropPendingTurnEvents } from '../transcripts/buffer';
import { stopAgentForDelete } from './stopAgentForDelete';
import { releaseAgentFiles } from './releaseAgentFiles';
import { omitDeletedAgents } from './omitDeletedAgents';
import type { GetFn, SetFn } from './types';

export const deleteAgent = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const workspaceId = get().sessions.find((sess) => sess.id === sessionId)?.workspaceId;
    const runStopped = await stopAgentForDelete({ get, agentId });
    await releaseAgentFiles({ get, sessionId, agentId, isRunStopped: runStopped });

    purgedAgentIds.add(agentId);
    let removedQuestions: ReadonlyArray<string> = [];
    try {
      removedQuestions = await purgeAgentForDelete({ db: tauriDatabase, id: agentId });
    } catch (error) {
      purgedAgentIds.delete(agentId);
      throw error;
    }
    if (removedQuestions.length > 0) {
      const slotChanged = await removeQuestionsFromSlot(
        tauriDatabase,
        sessionId,
        removedQuestions,
      ).catch(() => false);
      if (slotChanged) {
        await get().loadSessionSlots(sessionId);
      }
    }
    await get().loadSessionOpenQuestions(sessionId);
    if (!runStopped) {
      void get()
        .emitNotification({
          kind: 'error',
          severity: 'warning',
          title: 'Deleted agent is still running',
          body: 'The transcript is gone, but the provider process did not stop. Anything it writes from here is discarded. Quit it yourself if it keeps holding the worktree.',
          sessionId,
          ...(workspaceId !== undefined && { workspaceId }),
        })
        .catch(() => undefined);
    }
    const refreshed = await invokeAgentList(sessionId);
    let derived: ReturnType<typeof deriveSessionState> | null = null;
    dropPendingTurnEvents({ agentIds: [agentId] });
    set((s) => {
      const cleared = omitDeletedAgents({ state: s, sessionId, agentIds: new Set([agentId]) });
      const survivorStates = refreshed
        .map((a) => cleared.agentTurnState[a.id])
        .filter((st): st is NonNullable<typeof st> => st !== undefined);
      derived = deriveSessionState(survivorStates, new Date().toISOString() as IsoDateTime);
      return {
        ...cleared,
        sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
        sessions: s.sessions.map((sess) =>
          sess.id === sessionId ? { ...sess, state: derived! } : sess,
        ),
      };
    });
    if (derived !== null) {
      await updateSessionState(
        tauriDatabase,
        sessionId,
        derived,
        new Date().toISOString() as IsoDateTime,
      ).catch(() => undefined);
    }
  };
};
