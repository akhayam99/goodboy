import type { Agent, AgentId, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { isHandsFree } from './handsFree';
import type { GetFn, SetFn } from './types';

const MAX_CONTINUE = 1;

export type ContinueUnit = 'step' | 'cluster';

export type ContinueOutcome = 'continued' | 'blocked' | 'failed';

type HaltCopy = {
  readonly title: string;
  readonly handsFree: string;
  readonly manual: string;
};

const BLOCKED_COPY = {
  step: {
    title: 'Step blocked',
    handsFree:
      'The agent stopped twice without finishing this step and without asking you anything. Tell it what to do next in the agent chat, or skip the step.',
    manual:
      'Autorun is off, so this step waits for you. Tell the agent what to do next in the agent chat, or turn on autorun.',
  },
  cluster: {
    title: 'Subagent blocked',
    handsFree:
      "The implementer stopped twice without finishing this subagent's part and without asking you anything. Tell it what to do next in the agent chat.",
    manual:
      'Autorun is off, so this subagent waits for you. Tell it what to do next in the agent chat, or turn on autorun.',
  },
} as const satisfies Record<ContinueUnit, HaltCopy>;

const FAILED_COPY = {
  step: {
    title: 'Step failed',
    body: 'The agent stopped responding before it finished this step. Open the agent and run it again.',
  },
  cluster: {
    title: 'Subagent failed',
    body: "The implementer stopped responding before it finished this subagent's part. Open the agent and run it again.",
  },
} as const satisfies Record<ContinueUnit, Pick<HaltCopy, 'title'> & { readonly body: string }>;

type HaltNoticeParams = {
  readonly unit: ContinueUnit;
  readonly didAgentDie: boolean;
  readonly handsFree: boolean;
};

const haltNotice = ({ unit, didAgentDie, handsFree }: HaltNoticeParams) => {
  if (didAgentDie) {
    return FAILED_COPY[unit];
  }
  const copy = BLOCKED_COPY[unit];
  return { title: copy.title, body: handsFree ? copy.handsFree : copy.manual };
};

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
  readonly didAgentDie: boolean;
  readonly restart: () => void;
};

export const continueOrPause = async ({
  set,
  get,
  sessionId,
  agent,
  workflowRunId,
  unit,
  didAgentDie,
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
  const status = didAgentDie ? 'failed' : 'blocked';
  await invokeAgentUpdateStatus(agent.id, { status, completedAt: nowIso() });
  const stalled = await invokeAgentList(sessionId);
  set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: stalled } }));
  void get().refreshUnreadWorkspaces();
  const notice = haltNotice({ unit, didAgentDie, handsFree });
  void get().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: `${notice.title} on ${agent.name}`,
    body: notice.body,
    sessionId,
  });
  return status;
};
