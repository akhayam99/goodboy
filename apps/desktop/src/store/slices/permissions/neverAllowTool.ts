import type { AgentId, PermissionRulePattern, ProviderRunId, SessionId } from '@goodboy/types';
import { throwIfRefused } from '../turn/refusal/throwIfRefused';
import { askBatchAfterAnswer } from './askBatchAfterAnswer';
import { denialNoticeOf } from './denialNoticeOf';
import { heldOnceAllowsOf } from './heldOnceAllowsOf';
import type { GetFn } from './types';
import { withHeldAnswers } from './withHeldAnswers';

type Params = {
  sessionId: SessionId;
  agentId: AgentId;
  toolUseId: string;
  toolName: string;
  runId: ProviderRunId;
  pattern: PermissionRulePattern;
};

type Deps = {
  readonly get: GetFn;
};

export const neverAllowTool = ({ get }: Deps) => {
  return async ({
    sessionId,
    agentId,
    toolUseId,
    toolName,
    runId,
    pattern,
  }: Params): Promise<void> => {
    await get().resolvePermissionRequest({
      sessionId,
      agentId,
      toolUseId,
      toolName,
      runId,
      scope: 'deny',
      pattern,
    });
    const { isWaiting, held } = askBatchAfterAnswer({
      transcripts: get().transcripts,
      agentId,
      toolUseId,
    });
    if (isWaiting) {
      return;
    }
    if (held.length === 0) {
      await get().drainAgentQueue({ sessionId, agentId });
      return;
    }
    throwIfRefused({
      result: await get().sendTurn({
        sessionId,
        agentId,
        content: withHeldAnswers({ held, prompt: denialNoticeOf({ toolName, reason: '' }) }),
        permissionOnceAllows: heldOnceAllowsOf({ held }),
      }),
    });
  };
};
