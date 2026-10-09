import type {
  IsoDateTime,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore, type LensKind } from '../../../../../store';
import { EMPTY_SESSION_DRAFT } from '../../../../../store/slices/sessionDraft/state';
import { SESSION, seedWorkflowScene } from '../workflowSeed';
import { WORKSPACE_SIBLINGS, seedWorkspaceChrome } from '../audit/workspaceChrome';
import { seedLoadedSession } from '../u21/seedLoadedSession';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-07T10:00:00.000Z' });

const at = (iso: string): IsoDateTime => clock.iso({ at: iso });

const SESSION_ID = 'mock-sidebar-session-webhooks' as SessionId;

const PINNED_GOALS = [
  'Paginate the payments list',
  'Rotate the notify-relay signing key',
  'Backfill ledger-core balances',
  'Speed up the monthly ledger export',
  'Add idempotency keys to payments-api',
  'Document the retry policy',
  'Trim the notify-relay payload',
  'Split the checkout error handlers',
  'Cache the exchange rates',
] as const;

export type SidebarNavConfig = {
  readonly lens: LensKind | null;
  readonly branches: number;
  readonly hasPullRequest: boolean;
  readonly isFolded: boolean;
  readonly pinCount: number;
  readonly hasDraft: boolean;
  readonly hasQuestion: boolean;
};

export const SIDEBAR_NAV_DEFAULTS: SidebarNavConfig = {
  lens: null,
  branches: 1,
  hasPullRequest: false,
  isFolded: false,
  pinCount: 0,
  hasDraft: false,
  hasQuestion: false,
};

const BRANCH_NAMES = [
  'harborline/webhook-retries',
  'harborline/retry-window',
  'harborline/signing-key-rotation',
  'harborline/ledger-backfill',
  'harborline/export-paging',
  'harborline/idempotency-keys',
] as const;

const REPOS = ['payments-api', 'ledger-core', 'notify-relay'] as const;

const sessionOf = (): Session => ({
  ...SESSION,
  id: SESSION_ID,
  goal: 'Retry failed webhook deliveries',
  state: { kind: 'idle', lastActivityAt: at('2026-10-07T09:55:00.000Z') },
  contextSlots: [],
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at('2026-10-06T09:00:00.000Z'),
  updatedAt: at('2026-10-07T09:55:00.000Z'),
  lastOpenedAt: at('2026-10-07T09:58:00.000Z'),
});

const pinnedSessionOf = ({ goal, index }: { readonly goal: string; readonly index: number }) => ({
  ...SESSION,
  id: `mock-sidebar-pinned-${index}` as SessionId,
  goal,
  state: { kind: 'idle', lastActivityAt: at('2026-10-07T08:00:00.000Z') } as const,
  contextSlots: [],
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at('2026-10-05T09:00:00.000Z'),
  updatedAt: at('2026-10-07T08:00:00.000Z'),
  lastOpenedAt: at(`2026-10-0${(index % 4) + 1}T09:00:00.000Z`),
});

const mountOf = ({ index }: { readonly index: number }): SessionProjectMount => {
  const repo = REPOS[index % REPOS.length] ?? 'payments-api';
  return {
    mountId: `mock-sidebar-mount-${index}` as MountId,
    sessionId: SESSION_ID,
    projectId: `mock-sidebar-project-${repo}-${index}` as ProjectId,
    mountName: repo,
    worktreePath: `/mock/harborline/${repo}/worktrees/${index}`,
    lastWorktreePath: null,
    repoRoot: `/mock/harborline/${repo}`,
    branch: BRANCH_NAMES[index] ?? `harborline/branch-${index}`,
    baseBranch: 'main',
    parallelIndex: index,
    isAttached: true,
    diskState: 'present',
    revision: 1,
  };
};

const questionOf = (): OpenQuestion => ({
  id: 'mock-sidebar-question-window' as OpenQuestionId,
  sessionId: SESSION_ID,
  text: 'Which retry window should the webhook use?',
  suggestedAnswers: ['Five minutes', 'One hour'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: at('2026-10-07T09:00:00.000Z'),
});

const pullRequestOf = ({ mount }: { readonly mount: SessionProjectMount }) => ({
  mountId: mount.mountId,
  projectId: mount.projectId,
  revision: 1,
  repository: null,
  host: null,
  branch: mount.branch,
  prs: [],
  links: [],
  pr: {
    number: 331,
    title: 'Retry window for webhook deliveries',
    url: 'https://github.com/harborline/notify-relay/pull/331',
    state: 'open' as const,
    mergeable: true,
    checks: 'success' as const,
    baseBranch: 'main',
    headBranch: mount.branch,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-10-07T09:00:00.000Z',
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

export type SidebarNavSeed = {
  readonly session: Session;
  readonly workspaceId: WorkspaceId;
  readonly pinned: ReadonlyArray<Session>;
};

export const seedSidebarNav = (config: SidebarNavConfig): SidebarNavSeed => {
  seedWorkflowScene();
  const session = sessionOf();
  const pinned = PINNED_GOALS.slice(0, config.pinCount).map((goal, index) =>
    pinnedSessionOf({ goal, index }),
  );
  seedWorkspaceChrome({ session, siblings: [...WORKSPACE_SIBLINGS, ...pinned] });
  seedLoadedSession({ session });
  const mounts = Array.from({ length: config.branches }, (_, index) => mountOf({ index }));
  const withPullRequest = mounts[1] ?? mounts[0];
  const state = useAppStore.getState();
  useAppStore.setState({
    activeLens: { ...state.activeLens, [session.id]: config.lens },
    sessionBranches: { ...state.sessionBranches, [session.id]: mounts[0]?.branch ?? '' },
    sessionProjectMounts: { ...state.sessionProjectMounts, [session.id]: mounts },
    diffMountPath: { ...state.diffMountPath, [session.id]: mounts[0]?.worktreePath ?? null },
    mountGithub:
      config.hasPullRequest && withPullRequest !== undefined
        ? {
            ...state.mountGithub,
            [withPullRequest.mountId]: pullRequestOf({ mount: withPullRequest }),
          }
        : state.mountGithub,
    sessionOpenQuestions: {
      ...state.sessionOpenQuestions,
      [session.id]: config.hasQuestion ? [questionOf()] : [],
    },
    sessionPagesFolded: config.isFolded ? { [session.id]: true } : {},
    sessionPins: {
      [session.workspaceId]: pinned.map((entry, index) => ({
        id: entry.id as SessionId,
        at: index + 1,
      })),
    },
    sessionDrafts: config.hasDraft
      ? { [session.workspaceId]: { ...EMPTY_SESSION_DRAFT, workflowGoal: 'Add rate limits' } }
      : {},
  });
  return { session, workspaceId: session.workspaceId, pinned };
};
