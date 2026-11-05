import type { Agent, AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { NAMES } from '../../../shared/utils/names';
import { isHandsFree } from './handsFree';
import { isAfterStuckAgent } from './stuckStep/isAfterStuckAgent';
import type { GetFn, SetFn } from './types';

const MAX_CONTINUE = 1;

type ContinueUnit = 'step' | 'cluster';

export type ContinueOutcome = 'continued' | 'blocked' | 'failed' | 'stuck';

export const SILENT_STUCK_REASON = 'The agent stopped without finishing and without saying why.';

const TWO_IN_A_ROW_COPY = {
  step: {
    title: 'Run stopped',
    body: 'Two steps in a row did not finish, so the run stopped. Open the agent, then keep it working or skip it.',
  },
  cluster: {
    title: 'Run stopped',
    body: 'Two subagents in a row did not finish, so the run stopped. Open the agent, then keep it working or skip it.',
  },
} as const satisfies Record<ContinueUnit, { readonly title: string; readonly body: string }>;

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
    manual: `${NAMES.asksYou} is set to ${NAMES.everyStep}, so this step waits for you. Tell the agent what to do next in the agent chat, or change ${NAMES.asksYou}.`,
  },
  cluster: {
    title: 'Subagent blocked',
    handsFree:
      "The implementer stopped twice without finishing this subagent's part and without asking you anything. Tell it what to do next in the agent chat.",
    manual: `${NAMES.asksYou} is set to ${NAMES.everyStep}, so this subagent waits for you. Tell it what to do next in the agent chat, or change ${NAMES.asksYou}.`,
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
  readonly hasStuckMarker: boolean;
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
  hasStuckMarker,
  restart,
}: Params): Promise<ContinueOutcome> => {
  const handsFree = isHandsFree(get, sessionId, workflowRunId);
  const attempts = get().workflowContinueAttempts[agent.id] ?? 0;
  if (!hasStuckMarker && handsFree && attempts < MAX_CONTINUE) {
    set((state) => ({
      workflowContinueAttempts: { ...state.workflowContinueAttempts, [agent.id]: attempts + 1 },
    }));
    restart();
    return 'continued';
  }
  resetContinueAttempts({ set, get, agentId: agent.id });
  const isAfterStuck = isAfterStuckAgent({ runs: get().sessionPhaseRuns[sessionId] ?? [], agent });
  if (!didAgentDie && handsFree && !isAfterStuck) {
    return 'stuck';
  }
  const status = didAgentDie ? 'failed' : 'blocked';
  await invokeAgentUpdateStatus(agent.id, { status, completedAt: isoNow() });
  const stalled = await invokeAgentList(sessionId);
  set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: stalled } }));
  void get().refreshUnreadWorkspaces();
  const notice =
    isAfterStuck && handsFree && !didAgentDie
      ? TWO_IN_A_ROW_COPY[unit]
      : haltNotice({ unit, didAgentDie, handsFree });
  void get().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: `${notice.title} on ${agent.name}`,
    body: notice.body,
    sessionId,
  });
  return status;
};
