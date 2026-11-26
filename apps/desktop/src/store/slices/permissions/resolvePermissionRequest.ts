import type {
  AgentId,
  IsoDateTime,
  PermissionDecisionKind,
  PermissionRuleId,
  PermissionRulePattern,
  PermissionScope,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import { invokePermissionRuleUpsert } from '../../../features/permissions/permissions';
import { recordPermissionDecision } from './recordPermissionDecision';
import type { GetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  sessionId: SessionId;
  agentId: AgentId;
  toolUseId: string;
  toolName: string;
  runId: ProviderRunId;
  scope: PermissionScope;
  pattern?: PermissionRulePattern;
};

export const resolvePermissionRequest = (get: GetFn) => {
  return async ({ sessionId, agentId, toolUseId, toolName, runId, scope, pattern }: Params) => {
    const session = sessionById(get().sessions, sessionId);
    if (!session) {
      return;
    }
    const now = new Date().toISOString() as IsoDateTime;

    let ruleId: PermissionRuleId | null = null;
    if (scope !== 'once') {
      const ruleDecision: PermissionDecisionKind = scope === 'deny' ? 'deny' : 'allow';
      const ruleScope = scope === 'deny' ? 'session' : scope;
      const rulePattern = pattern ?? { tool: toolName };
      const stored = await invokePermissionRuleUpsert({
        scope: ruleScope,
        ...(ruleScope === 'workspace' ? { workspaceId: session.workspaceId } : {}),
        ...(ruleScope === 'session' ? { sessionId } : {}),
        patternTool: rulePattern.tool,
        ...(rulePattern.argsMatcher != null && { patternArgsMatcher: rulePattern.argsMatcher }),
        decision: ruleDecision,
        priority: 100,
      });
      ruleId = stored.id;
    }

    get().appendTurnEvent(agentId, sessionId, {
      kind: 'permission_decision',
      runId,
      toolUseId,
      decision: scope === 'deny' ? 'deny' : 'allow',
      scope,
      ruleId: null,
      decidedBy: 'user',
      at: now,
    });
    await recordPermissionDecision({
      get,
      sessionId,
      agentId,
      runId,
      toolUseId,
      toolName,
      decision: scope === 'deny' ? 'deny' : 'allow',
      ruleId,
      decidedAt: now,
    });
  };
};
