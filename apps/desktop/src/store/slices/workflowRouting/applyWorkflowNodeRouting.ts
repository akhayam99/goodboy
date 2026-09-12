import type {
  SessionId,
  Step,
  Workflow,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowTaskProfile,
} from '@goodboy/types';
import { invokeWorkflowNodeRoutingUpdate } from '../../../features/workflows/workflows';
import { WORKFLOW_ROUTING_COPY } from '../../../features/workflows/workflowRoutingCopy';
import { workflowNodeRoutingKey } from './workflowNodeRoutingKey';
import type { SetFn, WorkflowRoutingNodeRef } from './types';

type FailureParams = {
  readonly error: unknown;
};

const failureMessage = ({ error }: FailureParams): string => {
  if (typeof error !== 'object' || error === null) {
    return WORKFLOW_ROUTING_COPY.unknownFailure;
  }
  const kind = 'kind' in error ? (error as { readonly kind: unknown }).kind : null;
  if (kind === 'node_not_mutable') {
    return WORKFLOW_ROUTING_COPY.immutableRefusal;
  }
  const message = 'message' in error ? (error as { readonly message: unknown }).message : null;
  if (typeof message === 'string' && message !== '') {
    return message;
  }
  return WORKFLOW_ROUTING_COPY.unknownFailure;
};

type ErrorParams = {
  readonly set: SetFn;
  readonly key: string;
  readonly message: string | null;
};

export const setWorkflowNodeRoutingError = ({ set, key, message }: ErrorParams): void => {
  set((state) => ({
    workflowNodeRoutingErrors: { ...state.workflowNodeRoutingErrors, [key]: message },
  }));
};

type Params = WorkflowRoutingNodeRef & {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly lock: WorkflowRoutingLock | null;
  readonly decision: WorkflowRoutingDecision;
  readonly taskProfile: WorkflowTaskProfile | null;
};

export const applyWorkflowNodeRouting = async ({
  set,
  sessionId,
  nodeKind,
  id,
  lock,
  decision,
  taskProfile,
}: Params): Promise<boolean> => {
  const key = workflowNodeRoutingKey({ nodeKind, id });
  const pick = decision.selected;
  const provider = pick.provider;
  const effort = pick.effort;
  set((state) => ({
    workflowNodeRoutingPending: { ...state.workflowNodeRoutingPending, [key]: true },
    workflowNodeRoutingErrors: { ...state.workflowNodeRoutingErrors, [key]: null },
  }));
  try {
    await invokeWorkflowNodeRoutingUpdate({
      nodeKind,
      id,
      routingLock: lock,
      routingDecision: decision,
      taskProfile,
      providerOverride: provider,
      modelOverride: pick.model,
      effort,
    });
  } catch (error) {
    set((state) => ({
      workflowNodeRoutingPending: { ...state.workflowNodeRoutingPending, [key]: false },
      workflowNodeRoutingErrors: {
        ...state.workflowNodeRoutingErrors,
        [key]: failureMessage({ error }),
      },
    }));
    return false;
  }
  const agentEffort = effort === null ? {} : { effort };
  const patchStep = (step: Step): Step => {
    if (step.id !== id) {
      return step;
    }
    return {
      ...step,
      routingLock: lock,
      routingDecision: decision,
      taskProfile,
      providerOverride: provider,
      modelOverride: pick.model,
      ...agentEffort,
    };
  };
  const patchWorkflows = (workflows: ReadonlyArray<Workflow>): ReadonlyArray<Workflow> =>
    workflows.map((workflow) => ({ ...workflow, steps: workflow.steps.map(patchStep) }));
  set((state) => ({
    workflowNodeRoutingPending: { ...state.workflowNodeRoutingPending, [key]: false },
    ...(nodeKind === 'agent' && {
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
          agent.id === id
            ? {
                ...agent,
                routingLock: lock,
                routingDecision: decision,
                taskProfile,
                providerOverride: provider,
                modelOverride: pick.model,
                ...agentEffort,
              }
            : agent,
        ),
      },
      agentProviderOverride: { ...state.agentProviderOverride, [id]: provider },
      agentModelOverride: { ...state.agentModelOverride, [id]: pick.model },
      ...(effort !== null && {
        agentEffortOverride: { ...state.agentEffortOverride, [id]: effort },
      }),
    }),
    ...(nodeKind === 'step' && {
      sessionWorkflows: {
        ...state.sessionWorkflows,
        [sessionId]: patchWorkflows(state.sessionWorkflows[sessionId] ?? []),
      },
      phaseTemplates: Object.fromEntries(
        Object.entries(state.phaseTemplates).map(([workspaceId, workflows]) => [
          workspaceId,
          patchWorkflows(workflows),
        ]),
      ),
    }),
  }));
  return true;
};
