import type {
  AgentId,
  PermissionRulePattern,
  PermissionRuleId,
  PermissionRuleScope,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import { askBatchAfterAnswer } from './askBatchAfterAnswer';
import type { GetFn } from './types';

type Params = {
  sessionId: SessionId;
  agentId: AgentId;
  toolUseId: string;
  toolName: string;
  runId: ProviderRunId;
  scope: Extract<PermissionRuleScope, 'session' | 'workspace' | 'global'>;
  pattern: PermissionRulePattern;
};

type Deps = {
  readonly get: GetFn;
};

export const allowWithRule = ({ get }: Deps) => {
  return async ({
    sessionId,
    agentId,
    toolUseId,
    toolName,
    runId,
    scope,
    pattern,
  }: Params): Promise<PermissionRuleId | null> => {
    const ruleId = await get().resolvePermissionRequest({
      sessionId,
      agentId,
      toolUseId,
      toolName,
      runId,
      scope,
      pattern,
    });
    const { isWaiting } = askBatchAfterAnswer({
      transcripts: get().transcripts,
      agentId,
      toolUseId,
    });
    if (isWaiting) {
      return ruleId;
    }
    await get().retryBlockedTool({ sessionId, agentId, toolName, toolUseId });
    return ruleId;
  };
};
