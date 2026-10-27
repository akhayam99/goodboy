// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IntegrationDraft,
  type IsoDateTime,
  type SessionId,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import {
  FIXTURE_ROOT,
  FIXTURE_SESSION,
  aDelegation,
  aPlanRow,
  aView,
} from '../../../features/auto/testing/autoViewFixtures';
import { attentionWaitsOf } from './attentionWaitsOf';

const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-release' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const AT = brandId<IsoDateTime>({ value: '2026-10-07T09:00:00.000Z' });

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Release checklist',
  description: '',
  steps: [],
  createdAt: AT,
  updatedAt: AT,
};

const SESSION_ID = FIXTURE_SESSION;

const ROOT = anAgent({ id: FIXTURE_ROOT, sessionId: SESSION_ID, kind: 'auto', name: 'Auto' });

const CHILD = anAgent({
  id: brandId<AgentId>({ value: 'agent-scout' }),
  sessionId: SESSION_ID,
  parentAgentId: FIXTURE_ROOT,
});

const NONE = {
  hasStoppedRun: false,
  hasLimitPausedRun: false,
  hasRunWaitingForGo: false,
  hasAutoNeedsYou: false,
  hasSlackReplyWaiting: false,
};

type Over = Partial<Parameters<typeof attentionWaitsOf>[0]['state']>;

const waitsOf = ({
  state = {},
  workflowRuns = [],
}: {
  readonly state?: Over;
  readonly workflowRuns?: ReadonlyArray<ReturnType<typeof aWorkflowRun>>;
}) =>
  attentionWaitsOf({
    state: {
      sessionPhaseRuns: {},
      agentTurnState: {},
      sessionWorkflows: { [SESSION_ID]: [WORKFLOW] },
      ...state,
    },
    session: aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, workflowRuns }),
  });

const run = (over: Parameters<typeof aWorkflowRun>[0] = {}) =>
  aWorkflowRun({ workflowId: WORKFLOW_ID, executionMode: 'dynamic', ...over });

type StepAgentParams = {
  readonly runId: WorkflowRunId;
};

const stepAgentOf = ({ runId }: StepAgentParams) =>
  anAgent({
    sessionId: SESSION_ID,
    status: 'completed',
    stepId: brandId<StepId>({ value: 'step-1' }),
    workflowRunId: runId,
  });

describe('attentionWaitsOf and the runs of a session', () => {
  it('holds nothing for a quiet session', () => {
    expect(waitsOf({})).toEqual(NONE);
  });

  it('raises a run that stopped on a failure', () => {
    const stopped = run({ orchestrationStop: { kind: 'failure', message: 'Failed.' } });

    expect(waitsOf({ workflowRuns: [stopped] })).toEqual({ ...NONE, hasStoppedRun: true });
  });

  it('raises a run that paused at its limit', () => {
    const paused = run({ orchestrationStop: { kind: 'budget', message: 'Limit.' } });

    expect(waitsOf({ workflowRuns: [paused] })).toEqual({ ...NONE, hasLimitPausedRun: true });
  });

  it('raises a run that waits for Continue', () => {
    const waiting = run({ id: brandId<WorkflowRunId>({ value: 'run-go' }) });
    const state = { sessionPhaseRuns: { [SESSION_ID]: [stepAgentOf({ runId: waiting.id })] } };

    expect(waitsOf({ state, workflowRuns: [waiting] })).toEqual({
      ...NONE,
      hasRunWaitingForGo: true,
    });
  });

  it('raises nothing for a run whose workflow is not loaded', () => {
    const stopped = run({ orchestrationStop: { kind: 'failure', message: 'Failed.' } });

    expect(waitsOf({ state: { sessionWorkflows: {} }, workflowRuns: [stopped] })).toEqual(NONE);
  });

  it('raises nothing for a run the person closed, paused or archived', () => {
    const runs = [
      run({ orchestrationStop: { kind: 'closed', message: 'Closed.' } }),
      run({ orchestrationStop: { kind: 'paused', message: 'Paused.' } }),
      run({
        orchestrationStop: { kind: 'failure', message: 'Failed.' },
        discardedAt: AT,
      }),
    ];

    expect(waitsOf({ workflowRuns: runs })).toEqual(NONE);
  });

  it('keeps the orchestrator out of it while it decides the next step', () => {
    const deciding = run({ id: brandId<WorkflowRunId>({ value: 'run-deciding' }) });

    expect(
      waitsOf({
        state: {
          sessionPhaseRuns: { [SESSION_ID]: [stepAgentOf({ runId: deciding.id })] },
          orchestratingWorkflowRuns: { [deciding.id]: true },
        },
        workflowRuns: [deciding],
      }),
    ).toEqual(NONE);
  });
});

describe('attentionWaitsOf and Auto', () => {
  const stateOf = ({
    views,
    agents,
  }: {
    readonly views: ReadonlyArray<ReturnType<typeof aView>>;
    readonly agents: ReadonlyArray<typeof ROOT>;
  }): Over => ({
    sessionPhaseRuns: { [SESSION_ID]: agents },
    autoTreeViews: { [SESSION_ID]: views },
  });

  it('raises an Auto tree that is blocked', () => {
    expect(
      waitsOf({ state: stateOf({ views: [aView({ phase: 'blocked' })], agents: [ROOT] }) })
        .hasAutoNeedsYou,
    ).toBe(true);
  });

  it('raises an Auto tree whose plan waits for approval', () => {
    const view = aView({ phase: 'waiting', artifacts: [aPlanRow({ title: 'Retry plan' })] });

    expect(waitsOf({ state: stateOf({ views: [view], agents: [ROOT] }) }).hasAutoNeedsYou).toBe(
      true,
    );
  });

  it('raises nothing for an Auto tree that works, is done or was stopped', () => {
    for (const phase of ['waiting', 'answering', 'finished', 'stopped'] as const) {
      expect(
        waitsOf({ state: stateOf({ views: [aView({ phase })], agents: [ROOT] }) }).hasAutoNeedsYou,
        phase,
      ).toBe(false);
    }
  });

  it('raises nothing for a tree whose agent is gone, though its row stays open in the database', () => {
    expect(
      waitsOf({ state: stateOf({ views: [aView({ phase: 'blocked' })], agents: [] }) })
        .hasAutoNeedsYou,
    ).toBe(false);
    expect(
      waitsOf({
        state: stateOf({
          views: [aView({ phase: 'waiting', artifacts: [aPlanRow()] })],
          agents: [],
        }),
      }).hasAutoNeedsYou,
    ).toBe(false);
  });

  describe('a child that failed', () => {
    const failed = () =>
      aView({
        phase: 'waiting',
        delegations: [
          aDelegation({ key: 'scout', role: 'scout', state: 'settled', outcome: 'blocked' }),
        ],
      });

    it('raises the tree as stuck while the child agent is in the session', () => {
      expect(
        waitsOf({ state: stateOf({ views: [failed()], agents: [ROOT, CHILD] }) }).hasAutoNeedsYou,
      ).toBe(true);
    });

    it('does not call the tree stuck once the child agent is gone', () => {
      expect(
        waitsOf({ state: stateOf({ views: [failed()], agents: [ROOT] }) }).hasAutoNeedsYou,
      ).toBe(false);
    });
  });
});

describe('attentionWaitsOf and Slack', () => {
  const draft = (status: IntegrationDraft['status']): IntegrationDraft => ({
    id: brandId<IntegrationDraft['id']>({ value: 'draft-1' }),
    workspaceId: WORKSPACE_ID,
    sessionId: SESSION_ID,
    provider: 'slack',
    verb: 'reply',
    target: {},
    body: 'On it.',
    status,
    createdAt: AT,
    updatedAt: AT,
    decidedAt: null,
  });

  it('raises a reply that waits under Ask first', () => {
    expect(
      waitsOf({ state: { sessionSlackDrafts: { [SESSION_ID]: [draft('pending')] } } })
        .hasSlackReplyWaiting,
    ).toBe(true);
  });

  it('drops it once the reply is sent or discarded', () => {
    for (const status of ['sent', 'discarded'] as const) {
      expect(
        waitsOf({ state: { sessionSlackDrafts: { [SESSION_ID]: [draft(status)] } } })
          .hasSlackReplyWaiting,
        status,
      ).toBe(false);
    }
  });

  it('keeps another session draft out of this one', () => {
    const other = brandId<SessionId>({ value: 'session-elsewhere' });

    expect(
      waitsOf({ state: { sessionSlackDrafts: { [other]: [draft('pending')] } } })
        .hasSlackReplyWaiting,
    ).toBe(false);
  });
});
