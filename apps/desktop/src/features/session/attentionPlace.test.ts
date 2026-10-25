// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionAttentionReason,
  type SessionId,
  type StepId,
  type TurnState,
  type Workflow,
  type WorkflowId,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import { aView } from '../auto/testing/autoViewFixtures';
import { attentionPlace } from './attentionPlace';

const SESSION_ID = 'session-now' as SessionId;
const EARLIER = 'agent-earlier' as AgentId;
const LATEST = 'agent-latest' as AgentId;
const AT = '2026-10-04T08:00:00.000Z' as IsoDateTime;

type BlockedViewParams = {
  readonly rootAgentId: AgentId;
};

const blockedViewOf = ({ rootAgentId }: BlockedViewParams) => {
  const view = aView({ phase: 'blocked' });
  return { ...view, tree: { ...view.tree, sessionId: SESSION_ID, rootAgentId } };
};

type AgentParams = Pick<Agent, 'id' | 'ordinal' | 'status'>;

const agent = ({ id, ordinal, status }: AgentParams): Agent => ({
  id,
  sessionId: SESSION_ID,
  ordinal,
  name: `Agent ${ordinal}`,
  kind: 'implementer',
  status,
  lastFinishedAt: AT,
});

const AGENTS: ReadonlyArray<Agent> = [
  agent({ id: EARLIER, ordinal: 1, status: 'failed' }),
  agent({ id: LATEST, ordinal: 2, status: 'failed' }),
];

const HELD = aWorkflowRun({
  id: 'run-held' as WorkflowRunId,
  orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
});
const DISCARDED = aWorkflowRun({
  id: 'run-discarded' as WorkflowRunId,
  orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
  discardedAt: AT,
});
const RUNNING = aWorkflowRun({ id: 'run-going' as WorkflowRunId });

const state = {
  sessions: [aSession({ id: SESSION_ID, workflowRuns: [DISCARDED, RUNNING, HELD] })],
  sessionPhaseRuns: { [SESSION_ID]: AGENTS },
  agentTurnState: {
    [EARLIER]: {
      kind: 'blocked',
      runId: 'run-earlier' as ProviderRunId,
      blockedAt: AT,
    } satisfies TurnState,
    [LATEST]: {
      kind: 'blocked',
      runId: 'run-latest' as ProviderRunId,
      blockedAt: AT,
    } satisfies TurnState,
  },
};

type DestinationParams = {
  readonly reason: SessionAttentionReason;
};

const destination = ({ reason }: DestinationParams) =>
  attentionPlace({ state, sessionId: SESSION_ID, reason });

describe('attentionPlace', () => {
  it('opens the questions lens for an open question', () => {
    expect(destination({ reason: 'open-question' })).toMatchObject({
      at: 'session',
      view: { lens: 'questions' },
    });
  });

  it.each([
    ['ci-failed', 'checks'],
    ['changes-requested', 'pr'],
    ['pr-approved', 'pr'],
    ['fix-needs-you', 'comments'],
    ['fix-couldnt-fix', 'comments'],
  ] satisfies ReadonlyArray<readonly [SessionAttentionReason, string]>)(
    'opens the Branch on the tab that answers %s',
    (reason, tab) => {
      expect(destination({ reason })).toMatchObject({
        at: 'session',
        view: { lens: 'branch', target: { kind: 'branch', tab } },
      });
    },
  );

  it('opens the page of the run that holds the plan, skipping a discarded one', () => {
    expect(destination({ reason: 'plan-approval' })).toMatchObject({
      at: 'session',
      sessionId: SESSION_ID,
      view: { lens: 'workflows', target: { kind: 'run', runId: 'run-held' } },
    });
  });

  it('opens the runs list when no run holds a plan any more', () => {
    const settled = { ...state, sessions: [aSession({ id: SESSION_ID, workflowRuns: [RUNNING] })] };

    expect(
      attentionPlace({ state: settled, sessionId: SESSION_ID, reason: 'plan-approval' }),
    ).toMatchObject({ at: 'session', view: { lens: 'workflows', target: null } });
  });

  it.each([
    'agent-error',
    'unread-reply',
    'needs-approval',
  ] satisfies ReadonlyArray<SessionAttentionReason>)(
    'opens the latest actionable agent for %s',
    (reason) => {
      expect(destination({ reason })).toEqual({
        at: 'agent',
        sessionId: SESSION_ID,
        agentId: LATEST,
      });
    },
  );
});

describe('attentionPlace and the waits of a run', () => {
  const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-release' });
  const workflow = (): Workflow => ({
    id: WORKFLOW_ID,
    workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
    name: 'Release checklist',
    description: '',
    steps: [],
    createdAt: AT,
    updatedAt: AT,
  });
  const stopped = aWorkflowRun({
    id: brandId<WorkflowRunId>({ value: 'run-stopped' }),
    workflowId: WORKFLOW_ID,
    executionMode: 'dynamic',
    orchestrationStop: { kind: 'failure', message: 'Failed.' },
  });
  const limited = aWorkflowRun({
    id: brandId<WorkflowRunId>({ value: 'run-limited' }),
    workflowId: WORKFLOW_ID,
    executionMode: 'dynamic',
    orchestrationStop: { kind: 'budget', message: 'Limit.' },
  });
  const waiting = aWorkflowRun({
    id: brandId<WorkflowRunId>({ value: 'run-waiting' }),
    workflowId: WORKFLOW_ID,
    executionMode: 'dynamic',
  });
  const stepAgent: Agent = {
    ...agent({ id: brandId<AgentId>({ value: 'agent-step' }), ordinal: 3, status: 'completed' }),
    workflowRunId: brandId<WorkflowRunId>({ value: 'run-waiting' }),
    stepId: brandId<StepId>({ value: 'step-1' }),
  };
  const runsState = {
    ...state,
    sessions: [aSession({ id: SESSION_ID, workflowRuns: [stopped, limited, waiting] })],
    sessionPhaseRuns: { [SESSION_ID]: [...AGENTS, stepAgent] },
    sessionWorkflows: { [SESSION_ID]: [workflow()] },
  };

  it.each([
    ['run-stopped', 'run-stopped'],
    ['run-paused-at-limit', 'run-limited'],
    ['run-waits-for-go', 'run-waiting'],
  ] satisfies ReadonlyArray<readonly [SessionAttentionReason, string]>)(
    'opens the page of the run behind %s',
    (reason, runId) => {
      expect(attentionPlace({ state: runsState, sessionId: SESSION_ID, reason })).toMatchObject({
        at: 'session',
        sessionId: SESSION_ID,
        view: { lens: 'workflows', target: { kind: 'run', runId } },
      });
    },
  );

  it('opens the runs list when the run no longer waits', () => {
    expect(attentionPlace({ state, sessionId: SESSION_ID, reason: 'run-stopped' })).toMatchObject({
      at: 'session',
      view: { lens: 'workflows', target: null },
    });
  });
});

describe('attentionPlace and Auto or Slack', () => {
  const root = {
    ...agent({ id: brandId<AgentId>({ value: 'agent-auto-root' }), ordinal: 0, status: 'running' }),
    kind: 'auto',
    name: 'Auto',
  } satisfies Agent;
  const autoState = {
    ...state,
    sessionPhaseRuns: { [SESSION_ID]: [...AGENTS, root] },
    autoTreeViews: { [SESSION_ID]: [blockedViewOf({ rootAgentId: root.id })] },
  };

  it('opens the Auto agent that waits for you', () => {
    expect(
      attentionPlace({ state: autoState, sessionId: SESSION_ID, reason: 'auto-needs-you' }),
    ).toEqual({ at: 'agent', sessionId: SESSION_ID, agentId: root.id });
  });

  it('opens the session when the Auto tree no longer waits', () => {
    expect(
      attentionPlace({ state, sessionId: SESSION_ID, reason: 'auto-needs-you' }),
    ).toMatchObject({ at: 'session', sessionId: SESSION_ID });
  });

  it('opens the latest agent, where the Slack draft card sits', () => {
    expect(attentionPlace({ state, sessionId: SESSION_ID, reason: 'slack-reply-waiting' })).toEqual(
      { at: 'agent', sessionId: SESSION_ID, agentId: LATEST },
    );
  });
});
