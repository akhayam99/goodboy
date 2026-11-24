import { render } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type {
  IsoDateTime,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  Project,
  Session,
  SessionId,
  SessionProjectMount,
  TurnState,
  WorkspaceGitStatus,
} from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { MountGithubState, SessionGithubState } from '../../../store/types';
import { stubStoryInvoke, type StoryStore } from '../../../store/storyHarness';
import { ToastProvider } from '../../../shared/components/Toast';
import { StageBoard } from '../components/StageBoard';

export const harborline = aWorkspace({ name: 'Harborline', slug: 'harborline' });

export const paymentsApi = aProject({
  workspaceId: harborline.id,
  name: 'payments-api',
  kind: 'repo',
});
export const ledgerCore = aProject({
  workspaceId: harborline.id,
  name: 'ledger-core',
  kind: 'repo',
});
export const notifyRelay = aProject({
  workspaceId: harborline.id,
  name: 'notify-relay',
  kind: 'repo',
});

export const at = (iso: string): IsoDateTime => iso as IsoDateTime;

type SessionOptions = {
  readonly goal: string;
  readonly updatedAt?: string;
  readonly createdAt?: string;
  readonly lastOpenedAt?: string;
  readonly state?: TurnState;
};

export const sessionOf = ({
  goal,
  updatedAt = '2026-10-01T09:00:00.000Z',
  createdAt = '2026-09-01T09:00:00.000Z',
  lastOpenedAt,
  state = { kind: 'idle', lastActivityAt: at('2026-10-01T09:00:00.000Z') },
}: SessionOptions): Session =>
  aSession({
    workspaceId: harborline.id,
    goal,
    state,
    createdAt: at(createdAt),
    updatedAt: at(updatedAt),
    ...(lastOpenedAt !== undefined && { lastOpenedAt: at(lastOpenedAt) }),
  });

export const runningState = (): TurnState => ({
  kind: 'running',
  runId: 'run-harborline' as Extract<TurnState, { kind: 'running' }>['runId'],
  startedAt: at('2026-10-06T08:00:00.000Z'),
});

export const failedState = (): TurnState => ({
  kind: 'error',
  message: 'The agent stopped',
  failedAt: at('2026-10-06T08:00:00.000Z'),
});

export const openQuestionFor = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): OpenQuestion => ({
  id: `question-${sessionId}` as OpenQuestionId,
  sessionId,
  text: 'Which retry window should the webhook use?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: at('2026-10-05T09:00:00.000Z'),
});

export const mergedGithub = (): SessionGithubState => ({
  pr: {
    number: 304,
    title: 'Paginate the payments list',
    url: 'https://github.com/harborline/payments-api/pull/304',
    state: 'merged',
    mergeable: null,
    checks: 'success',
    baseBranch: 'main',
    headBranch: 'goodboy/pagination',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-10-04T09:00:00.000Z',
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

export const mountOf = ({
  session,
  project,
}: {
  readonly session: Session;
  readonly project: Project;
}): SessionProjectMount => ({
  mountId: `mount-${session.id}-${project.id}` as MountId,
  sessionId: session.id as SessionId,
  projectId: project.id,
  mountName: project.name,
  worktreePath: `/tmp/${project.name}/worktrees/${session.id}`,
  lastWorktreePath: null,
  repoRoot: `/tmp/${project.name}`,
  branch: `goodboy/${session.id}`,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

export const mountGithubOf = ({
  mount,
  number,
}: {
  readonly mount: SessionProjectMount;
  readonly number: number;
}): MountGithubState => ({
  mountId: mount.mountId,
  projectId: mount.projectId,
  revision: 1,
  repository: null,
  host: null,
  branch: mount.branch,
  prs: [],
  links: [],
  pr: {
    number,
    title: 'Retry window',
    url: `https://github.com/harborline/payments-api/pull/${number}`,
    state: 'open',
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: mount.branch,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-09-25T00:00:00.000Z',
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

type SeedParams = {
  readonly store: StoryStore;
  readonly sessions: ReadonlyArray<Session>;
  readonly archived?: ReadonlyArray<Session>;
  readonly currentSessionId?: SessionId | null;
  readonly questions?: ReadonlyArray<Session>;
  readonly mounts?: ReadonlyArray<readonly [Session, Project]>;
};

export const seedColumn = ({
  store,
  sessions,
  archived = [],
  currentSessionId = null,
  questions = [],
  mounts = [],
}: SeedParams): void => {
  store.setState({
    workspaces: [harborline],
    projects: [paymentsApi, ledgerCore, notifyRelay],
    sessions: [...sessions],
    archivedSessions: {
      [harborline.id]: archived.map((session) => ({
        ...session,
        archivedAt: session.archivedAt ?? at('2026-09-01T09:00:00.000Z'),
      })),
    },
    currentWorkspaceId: harborline.id,
    currentSessionId,
    sessionOpenQuestions: Object.fromEntries(
      questions.map((session) => [
        session.id,
        [openQuestionFor({ sessionId: session.id as SessionId })],
      ]),
    ),
    sessionProjectMounts: Object.fromEntries(
      mounts.map(([session, project]) => [session.id, [mountOf({ session, project })]]),
    ),
  });
};

type BoardParams = {
  readonly store: StoryStore;
};

const StoreBoard = () => {
  const sessions = useAppStore((state) => state.sessions);
  return <StageBoard workspaceId={harborline.id} sessions={sessions} />;
};

const READY_STATUS: WorkspaceGitStatus = {
  state: 'ready',
  branch: 'main',
  headSubject: 'Start the ledger',
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: null,
  inProgress: null,
};

export const prepareBoard = ({ store }: BoardParams): void => {
  store.setState((state) => ({
    navigation: {
      ...state.navigation,
      [harborline.id]: {
        entries: [
          {
            workspaceId: harborline.id,
            place: { at: 'board' },
            studio: null,
            focus: { drawer: null, scroll: {} },
          },
        ],
        index: 0,
      },
    },
    boardReady: true,
    projects: state.projects.map((project) => ({
      ...project,
      identityCheckedAt: at('2026-09-01T09:00:00.000Z'),
    })),
    projectGitStatus: Object.fromEntries(
      state.projects.map((project) => [project.id, READY_STATUS]),
    ),
  }));
  stubStoryInvoke({ project_git_status: READY_STATUS });
};

export const renderBoard = ({ store }: BoardParams) => {
  prepareBoard({ store });
  return render(
    <ToastProvider>
      <StoreBoard />
    </ToastProvider>,
  );
};
