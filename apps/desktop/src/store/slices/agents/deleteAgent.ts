import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { purgeAgentForDelete, updateSessionState } from '@goodboy/db';
import { removeQuestionsFromSlot } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn, deleteAttachment } from '../../../features/chat/turn';
import { abandonWorktreeWriter } from '../../../features/worktree/worktree';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { agentDestinationPath, agentWritePaths } from '../resolve/agentWritePath';
import { recoverSoleMount } from '../project-mounts/recoverSoleMount';
import { selectWritableMounts } from '../project-mounts/selectors';
import { cancelledRunIds, deriveSessionState, purgedAgentIds } from '../../session-mutators';
import { awaitRunStopped } from '../../awaitRunStopped';
import { dropPendingTurnEvents } from '../transcripts/buffer';
import type { GetFn, SetFn } from './types';

export const deleteAgent = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const agentTurn = get().agentTurnState[agentId];
    const agentRunId = agentTurn?.kind === 'running' ? agentTurn.runId : null;
    const workspaceId = get().sessions.find((sess) => sess.id === sessionId)?.workspaceId;
    let runStopped = true;
    if (agentRunId !== null) {
      cancelledRunIds.add(agentRunId);
      await cancelTurn(agentRunId).catch(() => undefined);
      runStopped = await awaitRunStopped({ runId: agentRunId }).catch(() => false);
    }

    for (const path of await agentWritePaths({ get, sessionId, agentId })) {
      await abandonWorktreeWriter({ path, holder: agentId });
    }

    const sole = recoverSoleMount({ mounts: selectWritableMounts({ state: get(), sessionId }) });
    const worktree = agentDestinationPath({ get, agentId }) ?? sole?.worktreePath ?? null;
    if (worktree !== null) {
      for (const att of get().agentAttachments[agentId] ?? []) {
        await deleteAttachment(worktree, att.relPath).catch(() => undefined);
      }
    }

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
        .emitNotification(
          'error',
          'warning',
          'Deleted agent is still running',
          'The transcript is gone, but the provider process did not stop. Anything it writes from here is discarded. Quit it yourself if it keeps holding the worktree.',
          {
            sessionId,
            ...(workspaceId !== undefined && { workspaceId }),
          },
        )
        .catch(() => undefined);
    }
    const refreshed = await invokeAgentList(sessionId);
    let derived: ReturnType<typeof deriveSessionState> | null = null;
    dropPendingTurnEvents({ agentIds: [agentId] });
    set((s) => {
      const wasSelected = s.selectedAgentId[sessionId] === agentId;
      const nextSelected = { ...s.selectedAgentId };
      if (wasSelected) {
        delete nextSelected[sessionId];
      }
      const nextTurnState = { ...s.agentTurnState };
      delete nextTurnState[agentId];
      const nextTranscripts = { ...s.transcripts };
      delete nextTranscripts[agentId];
      const nextDraft = { ...s.agentDraft };
      delete nextDraft[agentId];
      const nextAttachments = { ...s.agentAttachments };
      delete nextAttachments[agentId];
      const nextQueue = { ...s.agentQueue };
      delete nextQueue[agentId];
      const nextHistory = { ...s.agentRunHistory };
      delete nextHistory[agentId];
      const nextModelOverride = { ...s.agentModelOverride };
      delete nextModelOverride[agentId];
      const nextProviderOverride = { ...s.agentProviderOverride };
      delete nextProviderOverride[agentId];
      const nextEffortOverride = { ...s.agentEffortOverride };
      delete nextEffortOverride[agentId];
      const nextKindOverride = { ...s.agentKindOverride };
      delete nextKindOverride[agentId];
      const nextTurnDestination = { ...s.agentTurnDestination };
      delete nextTurnDestination[agentId];
      const survivorStates = refreshed
        .map((a) => nextTurnState[a.id])
        .filter((st): st is NonNullable<typeof st> => st !== undefined);
      derived = deriveSessionState(survivorStates, new Date().toISOString() as IsoDateTime);
      return {
        sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
        selectedAgentId: nextSelected,
        agentTurnState: nextTurnState,
        transcripts: nextTranscripts,
        agentDraft: nextDraft,
        agentAttachments: nextAttachments,
        agentQueue: nextQueue,
        agentRunHistory: nextHistory,
        agentModelOverride: nextModelOverride,
        agentProviderOverride: nextProviderOverride,
        agentEffortOverride: nextEffortOverride,
        agentKindOverride: nextKindOverride,
        agentTurnDestination: nextTurnDestination,
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
