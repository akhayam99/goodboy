import type { Agent, AgentRole, SessionId } from '@goodboy/types';
import { workflowRoutingFlags } from '../../../features/workflows/workflowRoutingFlags';
import { applyWorkflowNodeRouting } from '../workflowRouting/applyWorkflowNodeRouting';
import { resolveOneChildRouting } from './childRoutingBatch';
import type { GetFn, SetFn } from './types';

export type ChildRoutingRevalidation =
  Readonly<{ kind: 'ok' }> | Readonly<{ kind: 'blocked'; reason: string }>;

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly child: Agent;
  readonly role: AgentRole;
  readonly promptText: string;
};

export const revalidateChildRouting = async ({
  set,
  get,
  sessionId,
  child,
  role,
  promptText,
}: Params): Promise<ChildRoutingRevalidation> => {
  const decision = child.routingDecision ?? null;
  const lock = child.routingLock ?? null;
  if (decision === null && lock === null) {
    return { kind: 'ok' };
  }
  const outcome = resolveOneChildRouting({
    state: get(),
    sessionId,
    workflowRunId: child.workflowRunId ?? null,
    role,
    request: {
      proposal: decision?.proposal ?? null,
      promptText,
      childLock: lock,
    },
    isChildSelectionEnabled: workflowRoutingFlags().isChildModelSelectionEnabled,
  });
  if (outcome.kind === 'blocked') {
    return { kind: 'blocked', reason: outcome.reason };
  }
  if (outcome.kind === 'legacy') {
    return { kind: 'ok' };
  }
  const resolved = outcome.fields.routingDecision;
  if (resolved === null) {
    return { kind: 'ok' };
  }
  const selected = resolved.selected;
  const isUnchanged =
    selected.provider === child.providerOverride &&
    selected.model === child.modelOverride &&
    (selected.effort ?? null) === (child.effort ?? null);
  if (isUnchanged === true) {
    return { kind: 'ok' };
  }
  await applyWorkflowNodeRouting({
    set,
    sessionId,
    nodeKind: 'agent',
    id: child.id,
    lock,
    decision: resolved,
    taskProfile: outcome.fields.taskProfile,
  });
  return { kind: 'ok' };
};
