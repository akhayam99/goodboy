import type { Agent, OpenQuestionId, SessionId, WorkflowId } from '@goodboy/types';
import { extractMarkers, extractProseQuestion } from '@goodboy/core';
import { insertOpenQuestion } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { resetContinueAttempts } from './autoContinue';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly assistantText: string;
};

type StepLocation = {
  readonly workflowId: WorkflowId;
  readonly ordinal: number;
};

const stepLocationOf = ({
  get,
  sessionId,
  agent,
}: Pick<Params, 'get' | 'sessionId' | 'agent'>): StepLocation | null => {
  const state = get();
  const runs = state.sessionPhaseRuns[sessionId] ?? [];
  const stepId =
    agent.stepId ?? runs.find((candidate) => candidate.id === agent.parentAgentId)?.stepId;
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (stepId == null || session == null) {
    return null;
  }
  const run = session.workflowRuns.find((candidate) => candidate.id === agent.workflowRunId);
  const template = (state.phaseTemplates[session.workspaceId] ?? []).find(
    (candidate) => candidate.id === run?.workflowId,
  );
  const step = template?.steps.find((candidate) => candidate.id === stepId);
  if (template == null || step == null) {
    return null;
  }
  return { workflowId: template.id, ordinal: step.ordinal };
};

export const holdForUserQuestion = async ({
  set,
  get,
  sessionId,
  agent,
  assistantText,
}: Params): Promise<boolean> => {
  if (extractMarkers(assistantText).questions.length > 0) {
    resetContinueAttempts({ set, get, agentId: agent.id });
    return true;
  }
  const question = extractProseQuestion({ assistantText });
  if (question === null) {
    return false;
  }
  const location = stepLocationOf({ get, sessionId, agent });
  try {
    await insertOpenQuestion(tauriDatabase, {
      id: crypto.randomUUID() as OpenQuestionId,
      sessionId,
      ...(location !== null && {
        workflowId: location.workflowId,
        createdByStepOrdinal: location.ordinal,
        ownedByStepOrdinal: location.ordinal,
      }),
      ...(agent.workflowRunId != null && { workflowRunId: agent.workflowRunId }),
      createdByAgentId: agent.id,
      text: question,
      suggestedAnswers: [],
      isBlocking: true,
    });
  } catch {
    return false;
  }
  resetContinueAttempts({ set, get, agentId: agent.id });
  await get()
    .loadSessionOpenQuestions(sessionId)
    .catch(() => undefined);
  return true;
};
