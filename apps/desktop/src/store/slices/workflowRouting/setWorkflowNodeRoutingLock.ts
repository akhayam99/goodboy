import type { WorkflowRoutingLock } from '@goodboy/types';
import { resolveWorkflowRouting } from '@goodboy/core';
import { WORKFLOW_ROUTING_COPY } from '../../../features/workflows/workflowRoutingCopy';
import { applyWorkflowNodeRouting, setWorkflowNodeRoutingError } from './applyWorkflowNodeRouting';
import { workflowNodeRoutingContext } from './nodeRoutingContext';
import { workflowNodeRoutingKey } from './workflowNodeRoutingKey';
import type { GetFn, SetFn, SetWorkflowNodeRoutingLockParams } from './types';

export const setWorkflowNodeRoutingLock = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    nodeKind,
    id,
    pick,
  }: SetWorkflowNodeRoutingLockParams): Promise<void> => {
    const key = workflowNodeRoutingKey({ nodeKind, id });
    const context = workflowNodeRoutingContext({ state: get(), sessionId, nodeKind, id });
    if (context === null) {
      setWorkflowNodeRoutingError({ set, key, message: WORKFLOW_ROUTING_COPY.missingNode });
      return;
    }
    if (context.isMutable === false) {
      setWorkflowNodeRoutingError({ set, key, message: WORKFLOW_ROUTING_COPY.immutableRefusal });
      return;
    }
    const lock: WorkflowRoutingLock = { version: 1, pick, origin: 'user' };
    const resolution = resolveWorkflowRouting({
      agentLock: lock,
      stepLock: null,
      runRoleLock: context.runRoleLock,
      proposal: context.proposal,
      roleDefault: context.roleDefault,
      sessionDefault: context.sessionDefault,
      kindDefault: context.kindDefault,
      availability: context.availability,
      contextEstimate: null,
    });
    if (resolution.kind === 'blocked') {
      setWorkflowNodeRoutingError({ set, key, message: resolution.reason });
      return;
    }
    await applyWorkflowNodeRouting({
      set,
      sessionId,
      nodeKind,
      id,
      lock: { ...lock, pick: resolution.decision.selected },
      decision: resolution.decision,
      taskProfile: context.taskProfile,
    });
  };
};
