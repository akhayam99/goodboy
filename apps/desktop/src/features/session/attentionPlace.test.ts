// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type ProviderRunId,
  type ResolveThread,
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
import type { OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { useOpenQuestions } from '../context/components/QuestionsTab/useOpenQuestions';
import { aView } from '../auto/testing/autoViewFixtures';
import { attentionPlace } from './attentionPlace';
import type { NotificationPlaceReason } from './notificationPlaceReason';

const SESSION_ID = brandId<SessionId>({ value: 'session-now' });
const EARLIER = brandId<AgentId>({ value: 'agent-earlier' });
const LATEST = brandId<AgentId>({ value: 'agent-latest' });
const AT = brandId<IsoDateTime>({ value: '2026-10-04T08:00:00.000Z' });
const LEDGER_MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });

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
  id: brandId<WorkflowRunId>({ value: 'run-held' }),
  orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
});
const DISCARDED = aWorkflowRun({
  id: brandId<WorkflowRunId>({ value: 'run-discarded' }),
  orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
  discardedAt: AT,
});
const RUNNING = aWorkflowRun({ id: brandId<WorkflowRunId>({ value: 'run-going' }) });

const state = {
  sessions: [aSession({ id: SESSION_ID, workflowRuns: [DISCARDED, RUNNING, HELD] })],
  sessionPhaseRuns: { [SESSION_ID]: AGENTS },
  agentTurnState: {
    [EARLIER]: {
      kind: 'blocked',
      runId: brandId<ProviderRunId>({ value: 'run-earlier' }),
      blockedAt: AT,
    } satisfies TurnState,
    [LATEST]: {
      kind: 'blocked',
      runId: brandId<ProviderRunId>({ value: 'run-latest' }),
      blockedAt: AT,
    } satisfies TurnState,
  },
};

type DestinationParams = {
  readonly reason: SessionAttentionReason;
};

const destination = ({ reason }: DestinationParams) =>
  attentionPlace({ state, sessionId: SESSION_ID, reason });

const questionOf = (id: string): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId: SESSION_ID,
  text: 'Which ledger?',
  suggestedAnswers: [],
  isBlocking: false,
  userAnswer: null,
  status: 'open',
  createdAt: AT,
});

const delegateOf = (questionId: string): Agent => ({
  ...agent({ id: brandId<AgentId>({ value: 'agent-delegate' }), ordinal: 3, status: 'running' }),
  sourceKind: 'open_question',
  sourceThreadId: questionId,
});

const questionDestination = (agents: ReadonlyArray<Agent>) =>
  attentionPlace({
    state: {
      ...state,
      sessionPhaseRuns: { [SESSION_ID]: agents },
      sessionOpenQuestions: { [SESSION_ID]: [questionOf('q1'), questionOf('q2')] },
    },
    sessionId: SESSION_ID,
    reason: 'open-question',
  });

afterEach(() => {
  useOpenQuestions.setState({ staged: [] });
});

type WaitingParams = {
  readonly id: string;
  readonly originKind: ResolveThread['originKind'];
};

const waitingThread = ({ id, originKind }: WaitingParams): ResolveThread => ({
  id,
  sessionId: SESSION_ID,
  projectId: null,
  prNumber: null,
  threadId: id,
  originKind,
  diffCommentId: null,
  state: 'needs_answer',
  stage: 'asking',
  stateReason: null,
  revision: 1,
  generation: 1,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: null,
  replyDraft: null,
  commitShas: null,
  fixupOfSha: null,
  replacesSha: null,
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: 1,
  updatedAt: 1,
});

describe('attentionPlace', () => {
  it('skips a delegated question and a staged one when it picks the question to open', () => {
    expect(questionDestination([delegateOf('q1')])).toMatchObject({
      view: { target: { kind: 'question', questionId: 'q2' } },
    });
    useOpenQuestions.setState({ staged: [brandId<OpenQuestionId>({ value: 'q2' })] });
    expect(questionDestination([delegateOf('q1')])).toMatchObject({
      view: { lens: 'questions', target: null },
    });
  });

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

  it.each([
    ['ci-failed', 'checks'],
    ['push-failed', 'comments'],
    ['fix-needs-you', 'comments'],
    ['pr-approved', 'pr'],
    ['pr-opened', 'pr'],
    ['history-stopped', 'commits'],
  ] satisfies ReadonlyArray<readonly [NotificationPlaceReason, string]>)(
    'names the branch of a mount for %s',
    (reason, tab) => {
      const mounted = {
        ...state,
        sessionProjectMounts: {
          [SESSION_ID]: [
            {
              mountId: LEDGER_MOUNT,
              worktreePath: null,
              lastWorktreePath: '/work/ledger-core',
            },
          ],
        },
      };

      expect(
        attentionPlace({
          state: mounted,
          sessionId: SESSION_ID,
          reason,
          mountId: LEDGER_MOUNT,
        }),
      ).toMatchObject({
        at: 'session',
        view: { lens: 'branch', target: { kind: 'branch', mountPath: '/work/ledger-core', tab } },
      });
    },
  );

  it.each([
    ['note', 'files'],
    ['comment', 'comments'],
  ] as const)(
    'lands a fix notice about a %s on %s even when the other kind needs you too',
    (subject, tab) => {
      const mixed = {
        ...state,
        sessionResolveThreads: {
          [SESSION_ID]: [
            waitingThread({ id: 'thread-comment', originKind: 'review_comment' }),
            waitingThread({ id: 'thread-note', originKind: 'diff_comment' }),
          ],
        },
      };

      expect(
        attentionPlace({ state: mixed, sessionId: SESSION_ID, reason: 'fix-needs-you', subject }),
      ).toMatchObject({ view: { lens: 'branch', target: { kind: 'branch', tab } } });
    },
  );

  it('opens the branch with no path when the mount is gone', () => {
    expect(
      attentionPlace({
        state,
        sessionId: SESSION_ID,
        reason: 'ci-failed',
        mountId: brandId<MountId>({ value: 'mount-removed' }),
      }),
    ).toMatchObject({
      view: { lens: 'branch', target: { kind: 'branch', mountPath: null, tab: 'checks' } },
    });
  });

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
