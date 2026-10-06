import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  Project,
  ProjectId,
  ProviderRunId,
  Session,
  SessionExternalTask,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SESSION, WORKSPACE_ID, seedWorkflowScene } from '../workflowSeed';
import { seedWorkspaceChrome } from '../audit/workspaceChrome';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-06T10:00:00.000Z' });

const at = (iso: string): IsoDateTime => clock.iso({ at: iso });

const sessionId = (slug: string) => `mock-column-session-${slug}` as SessionId;

type SessionSeed = {
  readonly slug: string;
  readonly goal: string;
  readonly openedAt: string;
  readonly state?: Session['state'];
};

const sessionOf = ({ slug, goal, openedAt, state }: SessionSeed): Session => ({
  ...SESSION,
  id: sessionId(slug),
  goal,
  state: state ?? { kind: 'idle', lastActivityAt: at(openedAt) },
  contextSlots: [],
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at('2026-09-01T09:00:00.000Z'),
  updatedAt: at(openedAt),
  lastOpenedAt: at(openedAt),
});

const RUNNING_STATE = (slug: string): Session['state'] => ({
  kind: 'running',
  runId: `mock-column-run-${slug}` as ProviderRunId,
  startedAt: at('2026-10-06T09:40:00.000Z'),
});

const OLDER: ReadonlyArray<readonly [string, string]> = [
  ['Webhook signature rotation', '2026-10-03T10:00:00.000Z'],
  ['Rate limit dashboards', '2026-10-02T10:00:00.000Z'],
  ['Cascadia onboarding copy', '2026-09-30T10:00:00.000Z'],
  ['Acme invoice import', '2026-09-29T10:00:00.000Z'],
  ['Northwind CSV mapper', '2026-09-28T10:00:00.000Z'],
  ['Idempotency keys audit', '2026-09-24T10:00:00.000Z'],
  ['Notify digest batching', '2026-09-22T10:00:00.000Z'],
  ['Refund webhook tests', '2026-09-20T10:00:00.000Z'],
  ['Cascadia SSO callback', '2026-09-18T10:00:00.000Z'],
  ['Ledger rounding bug', '2026-09-15T10:00:00.000Z'],
  ['Dead letter queue replay', '2026-09-12T10:00:00.000Z'],
  ['Notify template linting', '2026-09-10T10:00:00.000Z'],
  ['Currency rounding spec', '2026-09-08T10:00:00.000Z'],
  ['Audit log retention', '2026-09-05T10:00:00.000Z'],
];

const SLUGS = {
  retry: 'retry',
  webhook: 'webhook',
  ledger: 'ledger',
  notify: 'notify',
  payments: 'payments',
} as const;

const HEAD: ReadonlyArray<Session> = [
  sessionOf({
    slug: SLUGS.retry,
    goal: 'Retry policy for 429s',
    openedAt: '2026-10-06T09:48:00.000Z',
  }),
  sessionOf({
    slug: SLUGS.webhook,
    goal: 'Fix webhook retries',
    openedAt: '2026-10-06T09:55:00.000Z',
    state: RUNNING_STATE(SLUGS.webhook),
  }),
  sessionOf({
    slug: SLUGS.ledger,
    goal: 'Ledger export speedup',
    openedAt: '2026-10-06T09:00:00.000Z',
    state: RUNNING_STATE(SLUGS.ledger),
  }),
  sessionOf({
    slug: SLUGS.notify,
    goal: 'Notify relay backoff',
    openedAt: '2026-10-06T06:00:00.000Z',
  }),
  sessionOf({
    slug: SLUGS.payments,
    goal: 'Payments API pagination',
    openedAt: '2026-10-04T10:00:00.000Z',
  }),
];

const TAIL: ReadonlyArray<Session> = OLDER.map(([goal, openedAt], index) =>
  sessionOf({ slug: `older-${index}`, goal, openedAt }),
);

const ARCHIVED: ReadonlyArray<Session> = [
  {
    ...sessionOf({
      slug: 'legacy',
      goal: 'Legacy hook cleanup',
      openedAt: '2026-07-01T10:00:00.000Z',
    }),
    archivedAt: at('2026-07-02T10:00:00.000Z'),
  },
  {
    ...sessionOf({
      slug: 'spike',
      goal: 'Spike: batch settle',
      openedAt: '2026-07-03T10:00:00.000Z',
    }),
    archivedAt: at('2026-07-04T10:00:00.000Z'),
  },
];

const SESSION_COLUMN_OPEN_ID = sessionId(SLUGS.webhook);
const SESSION_COLUMN_SESSIONS: ReadonlyArray<Session> = [...HEAD, ...TAIL];

const OVERRIDES: Project['overrides'] = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

const project = (name: string): Project => ({
  id: `mock-column-project-${name}` as ProjectId,
  workspaceId: WORKSPACE_ID,
  name,
  rootPath: `/mock/harborline/${name}`,
  kind: 'repo',
  overrides: OVERRIDES,
  createdAt: at('2026-08-01T10:00:00.000Z'),
  updatedAt: at('2026-10-01T10:00:00.000Z'),
});

const PAYMENTS = project('payments-api');
const RELAY = project('notify-relay');
const LEDGER = project('ledger-core');

const mount = ({ session, repo }: { readonly session: string; readonly repo: Project }) => ({
  mountId: `mock-column-mount-${session}-${repo.name}` as MountId,
  sessionId: sessionId(session),
  projectId: repo.id,
  mountName: repo.name,
  worktreePath: `/mock/harborline/${repo.name}-wt`,
  lastWorktreePath: null,
  repoRoot: repo.rootPath,
  branch: `harborline/${session}`,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present' as const,
  revision: 1,
});

const MOUNTS: Readonly<Record<string, ReadonlyArray<SessionProjectMount>>> = {
  [sessionId(SLUGS.webhook)]: [
    mount({ session: SLUGS.webhook, repo: PAYMENTS }),
    mount({ session: SLUGS.webhook, repo: RELAY }),
  ],
  [sessionId(SLUGS.ledger)]: [mount({ session: SLUGS.ledger, repo: LEDGER })],
  [sessionId(SLUGS.retry)]: [mount({ session: SLUGS.retry, repo: PAYMENTS })],
  [sessionId(SLUGS.notify)]: [mount({ session: SLUGS.notify, repo: RELAY })],
  [sessionId(SLUGS.payments)]: [mount({ session: SLUGS.payments, repo: PAYMENTS })],
};

const QUESTION: OpenQuestion = {
  id: 'mock-column-question-window' as OpenQuestionId,
  sessionId: sessionId(SLUGS.retry),
  text: 'Which retry window should the webhook use?',
  suggestedAnswers: ['Five minutes', 'One hour'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: at('2026-10-06T09:48:00.000Z'),
};

const TASK: SessionExternalTask = {
  sessionId: sessionId(SLUGS.webhook),
  provider: 'linear',
  externalId: 'mock-column-task-212',
  identifier: 'HBL-212',
  url: 'https://linear.app/harborline/issue/HBL-212',
  title: 'Webhook retries post twice',
  createdAt: at('2026-10-01T10:00:00.000Z'),
};

const agent = ({
  slug,
  name,
  status,
  ordinal,
}: {
  readonly slug: string;
  readonly name: string;
  readonly status: Agent['status'];
  readonly ordinal: number;
}): Agent => ({
  id: `mock-column-agent-${slug}-${ordinal}` as AgentId,
  sessionId: sessionId(slug),
  ordinal,
  name,
  status,
});

const github = ({
  state,
  number,
  isDraft,
}: {
  readonly state: 'draft' | 'merged';
  readonly number: number;
  readonly isDraft: boolean;
}) => ({
  pr: {
    number,
    title: 'Paginate the payments list',
    url: `https://github.com/harborline/payments-api/pull/${number}`,
    state,
    mergeable: null,
    checks: 'success' as const,
    baseBranch: 'main',
    headBranch: `harborline/pr-${number}`,
    isDraft,
    reviewDecision: null,
    body: '',
    updatedAt: at('2026-10-06T09:00:00.000Z'),
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

export const seedSessionColumn = ({
  isArchivedShown,
}: {
  readonly isArchivedShown: boolean;
}): Session => {
  seedWorkflowScene();
  const open =
    SESSION_COLUMN_SESSIONS.find((session) => session.id === SESSION_COLUMN_OPEN_ID) ?? SESSION;
  const siblings = SESSION_COLUMN_SESSIONS.filter(
    (session) => session.id !== SESSION_COLUMN_OPEN_ID,
  );
  seedWorkspaceChrome({ session: open, siblings });
  const state = useAppStore.getState();
  useAppStore.setState({
    projects: [PAYMENTS, RELAY, LEDGER],
    archivedSessions: { [WORKSPACE_ID]: ARCHIVED },
    sessionProjectMounts: { ...state.sessionProjectMounts, ...MOUNTS },
    sessionOpenQuestions: { ...state.sessionOpenQuestions, [sessionId(SLUGS.retry)]: [QUESTION] },
    sessionExternalTasks: { ...state.sessionExternalTasks, [sessionId(SLUGS.webhook)]: [TASK] },
    sessionPlans: { ...state.sessionPlans, [SESSION_COLUMN_OPEN_ID]: [] },
    sessionWorkflows: { ...state.sessionWorkflows, [SESSION_COLUMN_OPEN_ID]: [] },
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId(SLUGS.webhook)]: [
        agent({ slug: SLUGS.webhook, name: 'Planner', status: 'completed', ordinal: 0 }),
        agent({ slug: SLUGS.webhook, name: 'Implementer', status: 'running', ordinal: 1 }),
      ],
    },
    sessionGithub: {
      ...state.sessionGithub,
      [sessionId(SLUGS.webhook)]: github({ state: 'draft', number: 318, isDraft: true }),
      [sessionId(SLUGS.payments)]: github({ state: 'merged', number: 304, isDraft: false }),
    },
    sessionViewPrefs: {
      [WORKSPACE_ID]: {
        sort: 'needsYou',
        group: 'none',
        isArchivedShown,
        isFoldOpen: false,
      },
    },
    loadArchivedSessions: async () => undefined,
  });
  return open;
};
