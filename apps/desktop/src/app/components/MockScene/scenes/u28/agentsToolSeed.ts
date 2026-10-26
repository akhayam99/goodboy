import { brandId, type Agent, type AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { FLOW_AGENTS, FLOW_SESSION_ID } from '../flow-audit/fixtures';
import { seedWorkflowRun } from '../flow-audit/seeds';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

const BASE = FLOW_AGENTS[0];

export const AGENTS_TOOL_SESSION_ID = FLOW_SESSION_ID;

type HandParams = {
  readonly key: string;
  readonly name: string;
  readonly status: Agent['status'];
  readonly startedAt: string;
  readonly lastFinishedAt?: string;
};

const agentIdOf = ({ key }: Pick<HandParams, 'key'>): AgentId =>
  brandId<AgentId>({ value: `mock-tool-agent-${key}` });

const handAgentOf = ({ key, name, status, startedAt, lastFinishedAt }: HandParams): Agent => {
  if (BASE === undefined) {
    throw new Error('the flow seed has no agents');
  }
  return {
    ...BASE,
    id: agentIdOf({ key }),
    sessionId: FLOW_SESSION_ID,
    stepId: undefined,
    workflowRunId: undefined,
    parentAgentId: undefined,
    ordinal: 0,
    name,
    kind: 'scout',
    status,
    startedAt: clock.iso({ at: startedAt }),
    completedAt: undefined,
    doneAt: undefined,
    stoppedBy: undefined,
    lastFinishedAt: lastFinishedAt === undefined ? undefined : clock.iso({ at: lastFinishedAt }),
    lastViewedAt: undefined,
  };
};

export const AGENTS_TOOL_RUNNER_ID = agentIdOf({ key: 'runner' });

export const AGENTS_TOOL_REVIEWER_ID = agentIdOf({ key: 'reviewer' });

export const AGENTS_TOOL_AGENTS: ReadonlyArray<Agent> = [
  handAgentOf({
    key: 'runner',
    name: 'Trace the retried webhook in payments-api',
    status: 'running',
    startedAt: '2026-09-16T11:05:00.000Z',
  }),
  handAgentOf({
    key: 'reviewer',
    name: 'Review the notify-relay backoff change',
    status: 'completed',
    startedAt: '2026-09-16T09:40:00.000Z',
    lastFinishedAt: '2026-09-16T10:10:00.000Z',
  }),
  handAgentOf({
    key: 'blocked',
    name: 'Tidy the Cascadia fixtures',
    status: 'blocked',
    startedAt: '2026-09-16T10:50:00.000Z',
  }),
];

type Params = {
  readonly isEmpty: boolean;
  readonly selectedAgentId: AgentId | null;
};

export const seedAgentsTool = ({ isEmpty, selectedAgentId }: Params): void => {
  const { navigate } = useAppStore.getState();
  seedWorkflowRun();
  useAppStore.setState({
    navigate,
    phaseTemplates: {},
    sessionPhaseRuns: { [FLOW_SESSION_ID]: isEmpty ? [] : AGENTS_TOOL_AGENTS },
    sessionWorkflows: { [FLOW_SESSION_ID]: [] },
    agentKindOverride: {},
    focusedWorkflowRunId: {},
    sessionOpenQuestions: { [FLOW_SESSION_ID]: [] },
    selectedAgentId: selectedAgentId === null ? {} : { [FLOW_SESSION_ID]: selectedAgentId },
    agentTurnState: {},
  });
  useAppStore.setState({ currentSessionId: FLOW_SESSION_ID });
};
