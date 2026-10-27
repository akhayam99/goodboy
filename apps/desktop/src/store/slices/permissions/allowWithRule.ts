import type {
  AgentId,
  PermissionRulePattern,
  PermissionRuleScope,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
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
  }: Params): Promise<void> => {
    await get().resolvePermissionRequest({
      sessionId,
      agentId,
      toolUseId,
      toolName,
      runId,
      scope,
      pattern,
    });
    await get().retryBlockedTool({ sessionId, agentId, toolName });
  };
};
