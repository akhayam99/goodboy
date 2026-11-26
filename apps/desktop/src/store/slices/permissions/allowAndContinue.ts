import { actionNounOf, oncePatternText } from '@goodboy/core/permissions';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';
import { throwIfRefused } from '../turn/refusal/throwIfRefused';
import { askBatchAfterAnswer } from './askBatchAfterAnswer';
import { heldOnceAllowsOf } from './heldOnceAllowsOf';
import { NO_RESOLVED_ASKS } from './noResolvedAsks';
import { recordPermissionDecision } from './recordPermissionDecision';
import type { GetFn } from './types';
import { withHeldAnswers } from './withHeldAnswers';
import { permissionRowOf } from './permissionRowOf';

type Params = {
  sessionId: SessionId;
  agentId: AgentId;
  toolUseId: string;
  toolName: string;
  input: unknown;
  runId: ProviderRunId;
};

type PromptParams = {
  readonly toolName: string;
};

const continuePromptOf = ({ toolName }: PromptParams): string => {
  const noun = actionNounOf({ toolName });
  const what = noun === 'command' ? 'that exact command' : `that ${noun}`;
  return `Permission for ${what} is granted for this one call. Continue where you stopped.`;
};

export const allowAndContinue = (get: GetFn) => {
  return async ({
    sessionId,
    agentId,
    toolUseId,
    toolName,
    input,
    runId,
  }: Params): Promise<void> => {
    const now = new Date().toISOString() as IsoDateTime;
    get().appendTurnEvent(agentId, sessionId, {
      kind: 'permission_decision',
      runId,
      toolUseId,
      decision: 'allow',
      scope: 'once',
      ruleId: null,
      decidedBy: 'user',
      at: now,
    });
    void recordPermissionDecision({
      get,
      sessionId,
      agentId,
      runId,
      toolUseId,
      toolName,
      decision: 'allow',
      ruleId: null,
      decidedAt: now,
    });
    const { isWaiting, held } = askBatchAfterAnswer({
      transcripts: get().transcripts,
      agentId,
      toolUseId,
    });
    if (isWaiting) {
      return;
    }
    throwIfRefused({
      result: await get().sendTurn({
        sessionId,
        agentId,
        content: withHeldAnswers({ held, prompt: continuePromptOf({ toolName }) }),
        permissionOnceAllows: [...heldOnceAllowsOf({ held }), oncePatternText({ toolName, input })],
        resolvedAsks: NO_RESOLVED_ASKS,
        ...permissionRowOf({ held }),
      }),
    });
  };
};
