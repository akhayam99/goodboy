import type { AgentId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { lastAssistantMessage } from '../../../../shared/utils/lastAssistantMessage';
import type { GetFn } from '../types';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

type Deps = {
  readonly get: GetFn;
};

export const markStepDone = ({ get }: Deps) => {
  return async ({ sessionId, agentId }: Params): Promise<void> => {
    try {
      const agent = (get().sessionPhaseRuns[sessionId] ?? []).find(
        (candidate) => candidate.id === agentId,
      );
      if (agent === undefined || agent.stepId == null || agent.workflowRunId == null) {
        return;
      }
      const turn = get().agentTurnState[agentId];
      if (turn?.kind === 'running' || turn?.kind === 'starting') {
        return;
      }
      if (get().transcripts[agentId] === undefined) {
        await get().loadAgentTranscript(sessionId, agentId, { isSelecting: false });
      }
      const closing = lastAssistantMessage({ events: get().transcripts[agentId] ?? [] });
      const { shouldAutoAdvance } = await get().finalizeWorkflowStep(
        sessionId,
        agentId,
        closing?.text ?? '',
        false,
        { force: true },
      );
      if (shouldAutoAdvance) {
        void get().maybeAutoAdvanceWorkflow(sessionId);
      }
    } catch (error) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "Couldn't mark the step done",
        body: formatError(error),
        sessionId,
      });
    }
  };
};
