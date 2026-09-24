import type { Agent, AgentId, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { isHandsFree } from './handsFree';
import type { GetFn, SetFn } from './types';

const MAX_CONTINUE = 1;

export type ContinueUnit = 'step' | 'cluster';

export type ContinueOutcome = 'continued' | 'paused';

type PauseCopy = {
  readonly title: string;
  readonly handsFree: string;
  readonly manual: string;
};

const PAUSE_COPY = {
  step: {
    title: 'Step paused',
    handsFree:
      'The agent stopped before emitting a step-done marker. Open the agent and continue manually.',
    manual:
      'Autorun is off, so this step will not continue on its own. Open the agent and continue manually, or turn on autorun.',
  },
  cluster: {
    title: 'Cluster paused',
    handsFree:
      'The implementer stopped before completing this cluster. Open the agent and continue manually.',
    manual:
      'Autorun is off, so this cluster will not continue on its own. Open the agent and continue manually, or turn on autorun.',
  },
} as const satisfies Record<ContinueUnit, PauseCopy>;

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

type ResetParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly agentId: AgentId;
};

export const resetContinueAttempts = ({ set, get, agentId }: ResetParams): void => {
  if (get().workflowContinueAttempts[agentId] === undefined) {
    return;
  }
  set((state) => {
    const { [agentId]: _dropped, ...rest } = state.workflowContinueAttempts;
    return { workflowContinueAttempts: rest };
  });
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly workflowRunId: WorkflowRunId | null | undefined;
  readonly unit: ContinueUnit;
  readonly restart: () => void;
};

export const continueOrPause = async ({
  set,
  get,
  sessionId,
  agent,
  workflowRunId,
  unit,
  restart,
}: Params): Promise<ContinueOutcome> => {
  const handsFree = isHandsFree(get, sessionId, workflowRunId);
  const attempts = get().workflowContinueAttempts[agent.id] ?? 0;
  if (handsFree && attempts < MAX_CONTINUE) {
    set((state) => ({
      workflowContinueAttempts: { ...state.workflowContinueAttempts, [agent.id]: attempts + 1 },
    }));
    restart();
    return 'continued';
  }
  resetContinueAttempts({ set, get, agentId: agent.id });
  await invokeAgentUpdateStatus(agent.id, { status: 'failed', completedAt: nowIso() });
  const stalled = await invokeAgentList(sessionId);
  set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: stalled } }));
  void get().refreshUnreadWorkspaces();
  const copy = PAUSE_COPY[unit];
  void get().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: `${copy.title} on ${agent.name}`,
    body: handsFree ? copy.handsFree : copy.manual,
    sessionId,
  });
  return 'paused';
};
