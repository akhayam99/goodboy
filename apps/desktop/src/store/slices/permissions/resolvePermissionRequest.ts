import type {
  AgentId,
  IsoDateTime,
  PermissionDecisionKind,
  PermissionScope,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import { invokePermissionRuleUpsert } from '../../../features/permissions/permissions';
import type { GetFn, SetFn } from './types';

type Params = {
  sessionId: SessionId;
  agentId: AgentId;
  toolUseId: string;
  toolName: string;
  runId: ProviderRunId;
  scope: PermissionScope;
};

export const resolvePermissionRequest = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId, toolUseId, toolName, runId, scope }: Params) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) {
      return;
    }
    const now = new Date().toISOString() as IsoDateTime;

    if (scope === 'once') {
      set((state) => ({
        volatilePermissionAllows: new Set([...state.volatilePermissionAllows, toolUseId]),
      }));
    } else {
      const ruleDecision: PermissionDecisionKind = scope === 'deny' ? 'deny' : 'allow';
      const ruleScope = scope === 'deny' ? 'session' : scope;
      await invokePermissionRuleUpsert({
        scope: ruleScope,
        ...(ruleScope === 'workspace' ? { workspaceId: session.workspaceId } : {}),
        ...(ruleScope === 'session' ? { sessionId } : {}),
        patternTool: toolName,
        decision: ruleDecision,
        priority: 100,
      });
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
  };
};
