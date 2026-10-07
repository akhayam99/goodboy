import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  ProviderRunId,
  PullRequestState,
  ResolveThread,
  Session,
  SessionId,
  TurnState,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { SessionGithubState } from '../../../../../store/types';
import { SESSION, WORKSPACE_ID, seedWorkflowScene } from '../workflowSeed';
import { seedWorkspaceChrome } from '../audit/workspaceChrome';
import { seedLoadedSession } from './seedLoadedSession';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-07T10:00:00.000Z' });

const at = (iso: string): IsoDateTime => clock.iso({ at: iso });

const idOf = (slug: string) => `mock-marks-session-${slug}` as SessionId;

type SessionSeed = {
  readonly slug: string;
  readonly goal: string;
  readonly openedAt: string;
  readonly state?: Session['state'];
  readonly workflowRuns?: ReadonlyArray<WorkflowRun>;
};

const sessionOf = ({ slug, goal, openedAt, state, workflowRuns = [] }: SessionSeed): Session => ({
  ...SESSION,
  id: idOf(slug),
  goal,
  state: state ?? { kind: 'idle', lastActivityAt: at(openedAt) },
  contextSlots: [],
  workflowRuns,
  autoRun: false,
  titleUserEdited: true,
  createdAt: at('2026-09-20T09:00:00.000Z'),
  updatedAt: at(openedAt),
  lastOpenedAt: at(openedAt),
});

const runningState = (slug: string): TurnState => ({
  kind: 'running',
  runId: `mock-marks-run-${slug}` as ProviderRunId,
  startedAt: at('2026-10-07T09:40:00.000Z'),
});

const heldRun = (slug: string): WorkflowRun => ({
  id: `mock-marks-run-${slug}` as WorkflowRunId,
  workflowId: 'mock-marks-workflow' as WorkflowRun['workflowId'],
  ordinal: 1,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'manual',
  executionMode: 'dynamic',
  orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
  createdAt: at('2026-10-07T08:00:00.000Z'),
});

const SESSIONS: ReadonlyArray<Session> = [
  sessionOf({
    slug: 'quiet',
    goal: 'Refactor the CSV mapper',
    openedAt: '2026-10-07T09:58:00.000Z',
  }),
  sessionOf({
    slug: 'error',
    goal: 'Billing export fails on large files',
    openedAt: '2026-10-07T09:50:00.000Z',
    state: {
      kind: 'error',
      message: 'The agent stopped with an error',
      failedAt: at('2026-10-07T09:49:00.000Z'),
    },
  }),
  sessionOf({
    slug: 'checks',
    goal: 'Stop notify-relay retries on a 409',
    openedAt: '2026-10-07T09:45:00.000Z',
  }),
  sessionOf({
    slug: 'question',
    goal: 'Pick the retry window for webhooks',
    openedAt: '2026-10-07T09:40:00.000Z',
  }),
  sessionOf({
    slug: 'approved',
    goal: 'Paginate the payments list',
    openedAt: '2026-10-07T09:35:00.000Z',
  }),
  sessionOf({
    slug: 'changes',
    goal: 'Move the ledger export to a queue',
    openedAt: '2026-10-07T09:30:00.000Z',
  }),
  sessionOf({
    slug: 'comments',
    goal: 'Add idempotency keys to payments-api',
    openedAt: '2026-10-07T09:25:00.000Z',
  }),
  sessionOf({
    slug: 'unfixed',
    goal: 'Backfill the settlement dates',
    openedAt: '2026-10-07T09:20:00.000Z',
  }),
  sessionOf({
    slug: 'tool',
    goal: 'Write the notify-relay digest',
    openedAt: '2026-10-07T09:15:00.000Z',
  }),
  sessionOf({
    slug: 'plan',
    goal: 'Plan the Cascadia onboarding',
    openedAt: '2026-10-07T09:10:00.000Z',
    workflowRuns: [heldRun('plan')],
  }),
  sessionOf({
    slug: 'reply',
    goal: 'Review the Acme import mapper',
    openedAt: '2026-10-07T09:05:00.000Z',
  }),
  sessionOf({
    slug: 'working',
    goal: 'Tune the rate limiter',
    openedAt: '2026-10-07T09:55:00.000Z',
    state: runningState('working'),
  }),
  sessionOf({
    slug: 'both',
    goal: 'Ship the refund webhook',
    openedAt: '2026-10-07T09:00:00.000Z',
  }),
  sessionOf({
    slug: 'review',
    goal: 'Add a Harborline export schema',
    openedAt: '2026-10-07T08:50:00.000Z',
  }),
  sessionOf({
    slug: 'merged',
    goal: 'Northwind CSV export',
    openedAt: '2026-10-07T08:40:00.000Z',
  }),
];

const pullRequest = ({
  number,
  over,
}: {
  readonly number: number;
  readonly over: Partial<PullRequestState>;
}): SessionGithubState => ({
  pr: {
    number,
    title: 'Retry webhooks with backoff',
    url: `https://github.com/harborline/payments-api/pull/${number}`,
    state: 'open',
    mergeable: null,
    checks: 'success',
    baseBranch: 'main',
    headBranch: `harborline/pr-${number}`,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: at('2026-10-07T09:00:00.000Z'),
    ...over,
  },
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const GITHUB: Readonly<Record<string, SessionGithubState>> = {
  [idOf('checks')]: pullRequest({ number: 312, over: { checks: 'failure' } }),
  [idOf('approved')]: pullRequest({
    number: 318,
    over: { state: 'approved', reviewDecision: 'approved' },
  }),
  [idOf('changes')]: pullRequest({ number: 321, over: { reviewDecision: 'changes_requested' } }),
  [idOf('both')]: pullRequest({
    number: 325,
    over: { state: 'approved', reviewDecision: 'approved', checks: 'failure' },
  }),
  [idOf('review')]: pullRequest({ number: 330, over: {} }),
  [idOf('merged')]: pullRequest({ number: 304, over: { state: 'merged' } }),
};

const questionFor = ({ slug }: { readonly slug: string }): OpenQuestion => ({
  id: `mock-marks-question-${slug}` as OpenQuestionId,
  sessionId: idOf(slug),
  text: 'Which retry window should the webhook use?',
  suggestedAnswers: ['Five minutes', 'One hour'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: at('2026-10-07T09:00:00.000Z'),
});

const threadFor = ({
  slug,
  state,
}: {
  readonly slug: string;
  readonly state: 'needs_answer' | 'failed';
}): ResolveThread => ({
  id: `mock-marks-thread-${slug}`,
  sessionId: idOf(slug),
  projectId: null,
  prNumber: 318,
  threadId: `mock-marks-github-thread-${slug}`,
  originKind: 'review_comment',
  diffCommentId: null,
  state,
  stage: state === 'failed' ? 'failed' : 'asking',
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
  question: state === 'needs_answer' ? 'Should the key be per customer or per request?' : null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: Date.parse('2026-10-07T08:30:00.000Z'),
  updatedAt: Date.parse('2026-10-07T09:00:00.000Z'),
});

const agentIdOf = (slug: string) => `mock-marks-agent-${slug}` as AgentId;

const agentFor = ({
  slug,
  status,
  isUnread,
}: {
  readonly slug: string;
  readonly status: Agent['status'];
  readonly isUnread: boolean;
}): Agent => ({
  id: agentIdOf(slug),
  sessionId: idOf(slug),
  ordinal: 0,
  name: 'Implementer',
  status,
  ...(isUnread && { lastFinishedAt: at('2026-10-07T08:55:00.000Z') }),
});

const PHASE_RUNS: Readonly<Record<string, ReadonlyArray<Agent>>> = {
  [idOf('tool')]: [agentFor({ slug: 'tool', status: 'running', isUnread: false })],
  [idOf('reply')]: [agentFor({ slug: 'reply', status: 'completed', isUnread: true })],
  [idOf('working')]: [agentFor({ slug: 'working', status: 'running', isUnread: false })],
};

const BLOCKED: Readonly<Record<string, TurnState>> = {
  [agentIdOf('tool')]: {
    kind: 'blocked',
    runId: 'mock-marks-run-tool' as ProviderRunId,
    blockedAt: at('2026-10-07T09:14:00.000Z'),
  },
};

export const seedSessionMarks = (): Session => {
  seedWorkflowScene();
  const [open, ...siblings] = SESSIONS;
  if (open === undefined) {
    return SESSION;
  }
  seedWorkspaceChrome({ session: open, siblings });
  seedLoadedSession({ session: open });
  const state = useAppStore.getState();
  useAppStore.setState({
    sessionGithub: { ...state.sessionGithub, ...GITHUB },
    sessionOpenQuestions: {
      ...state.sessionOpenQuestions,
      [idOf('question')]: [questionFor({ slug: 'question' })],
      [idOf('working')]: [questionFor({ slug: 'working' })],
    },
    sessionResolveThreads: {
      ...state.sessionResolveThreads,
      [idOf('comments')]: [threadFor({ slug: 'comments', state: 'needs_answer' })],
      [idOf('unfixed')]: [threadFor({ slug: 'unfixed', state: 'failed' })],
    },
    sessionPhaseRuns: { ...state.sessionPhaseRuns, ...PHASE_RUNS },
    agentTurnState: { ...state.agentTurnState, ...BLOCKED },
    sessionWorkflows: { ...state.sessionWorkflows, [idOf('plan')]: [] },
    sessionViewPrefs: {
      [WORKSPACE_ID]: {
        sort: 'needsYou',
        group: 'none',
        isArchivedShown: false,
        isFoldOpen: true,
      },
    },
  });
  return open;
};
