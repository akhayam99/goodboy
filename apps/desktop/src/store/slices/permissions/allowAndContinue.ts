import { oncePatternText } from '@goodboy/core';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

type Params = {
  sessionId: SessionId;
  agentId: AgentId;
  toolUseId: string;
  toolName: string;
  input: unknown;
  runId: ProviderRunId;
};

const CONTINUE_PROMPT =
  'Permission for that exact command is granted for this one call. Continue where you stopped.';

export const allowAndContinue = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    agentId,
    toolUseId,
    toolName,
    input,
    runId,
  }: Params): Promise<void> => {
    const now = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      volatilePermissionAllows: new Set([...state.volatilePermissionAllows, toolUseId]),
    }));
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
    await get().sendTurn({
      sessionId,
      agentId,
      content: CONTINUE_PROMPT,
      permissionOnceAllow: oncePatternText({ toolName, input }),
    });
  };
};
