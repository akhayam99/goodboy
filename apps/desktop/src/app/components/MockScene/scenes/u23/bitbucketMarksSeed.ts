import type {
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestChecks,
  PullRequestReviewDecision,
  Session,
  SessionId,
  SessionMountView,
} from '@goodboy/types';
import type { BitbucketPullRequest } from '../../../../../features/integrations/bitbucket/client';
import { useAppStore } from '../../../../../store';
import type { MountBitbucketPrState } from '../../../../../store/slices/bitbucket-pr/state';
import { sceneClock } from '../../sceneClock';
import { seedWorkspaceChrome } from '../audit/workspaceChrome';
import { seedLoadedSession } from '../u21/seedLoadedSession';
import { SESSION, WORKSPACE_ID, seedWorkflowScene } from '../workflowSeed';

const clock = sceneClock({ anchor: '2026-10-07T10:00:00.000Z' });

const at = (iso: string): IsoDateTime => clock.iso({ at: iso });

const idOf = (slug: string) => `mock-bb-marks-session-${slug}` as SessionId;
const mountIdOf = (slug: string) => `mock-bb-marks-mount-${slug}` as MountId;
const PROJECT_ID = 'mock-bb-marks-project-payments-api' as ProjectId;

type Seed = {
  readonly slug: string;
  readonly goal: string;
  readonly openedAt: string;
  readonly number?: number;
  readonly checks?: PullRequestChecks;
  readonly reviewDecision?: PullRequestReviewDecision | null;
};

const SEEDS: ReadonlyArray<Seed> = [
  { slug: 'quiet', goal: 'Refactor the CSV mapper', openedAt: '2026-10-07T09:58:00.000Z' },
  {
    slug: 'checks',
    goal: 'Stop notify-relay retries on a 409',
    openedAt: '2026-10-07T09:45:00.000Z',
    number: 42,
    checks: 'failure',
  },
  {
    slug: 'changes',
    goal: 'Move the ledger export to a queue',
    openedAt: '2026-10-07T09:30:00.000Z',
    number: 43,
    checks: 'success',
    reviewDecision: 'changes_requested',
  },
  {
    slug: 'approved',
    goal: 'Paginate the payments list',
    openedAt: '2026-10-07T09:35:00.000Z',
    number: 44,
    checks: 'success',
    reviewDecision: 'approved',
  },
  {
    slug: 'both',
    goal: 'Ship the refund webhook',
    openedAt: '2026-10-07T09:00:00.000Z',
    number: 45,
    checks: 'failure',
    reviewDecision: 'approved',
  },
];

const sessionOf = ({ slug, goal, openedAt }: Seed): Session => ({
  ...SESSION,
  id: idOf(slug),
  goal,
  state: { kind: 'idle', lastActivityAt: at(openedAt) },
  contextSlots: [],
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at('2026-09-20T09:00:00.000Z'),
  updatedAt: at(openedAt),
  lastOpenedAt: at(openedAt),
});

const mountOf = ({ slug }: Seed): SessionMountView => ({
  id: mountIdOf(slug),
  sessionId: idOf(slug),
  projectId: PROJECT_ID,
  worktreePath: `/work/payments-api-${slug}`,
  lastWorktreePath: null,
  branch: `harborline/${slug}`,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'payments-api',
  repoSlug: 'harborline/payments-api',
  repoRoot: '/work/payments-api',
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: at('2026-09-20T09:00:00.000Z'),
  updatedAt: at('2026-10-07T09:00:00.000Z'),
});

const pullRequestOf = ({
  seed,
  number,
}: {
  readonly seed: Seed;
  readonly number: number;
}): BitbucketPullRequest => ({
  id: number,
  title: seed.goal,
  description: '',
  state: 'OPEN',
  createdOn: at('2026-10-06T09:00:00.000Z'),
  updatedOn: at('2026-10-07T09:00:00.000Z'),
  sourceBranch: `harborline/${seed.slug}`,
  sourceCommit: null,
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: `https://bitbucket.org/harborline/payments-api/pull-requests/${number}`,
});

const entryOf = ({ seed }: { readonly seed: Seed }): MountBitbucketPrState | null => {
  if (seed.number === undefined) {
    return null;
  }
  const pr = pullRequestOf({ seed, number: seed.number });
  return {
    mountId: mountIdOf(seed.slug),
    projectId: PROJECT_ID,
    revision: 1,
    host: 'bitbucket.org',
    repo: null,
    repository: 'harborline/payments-api',
    branch: `harborline/${seed.slug}`,
    prs: [pr],
    links: [],
    checks: seed.checks ?? null,
    reviewDecision: seed.reviewDecision ?? null,
    pr,
    fetchedAt: at('2026-10-07T09:00:00.000Z'),
    loading: false,
    error: null,
  };
};

export const seedBitbucketMarks = (): Session => {
  seedWorkflowScene();
  const sessions = SEEDS.map((seed) => sessionOf(seed));
  const [open, ...siblings] = sessions;
  if (open === undefined) {
    return SESSION;
  }
  seedWorkspaceChrome({ session: open, siblings });
  seedLoadedSession({ session: open });
  const state = useAppStore.getState();
  useAppStore.setState({
    sessionMounts: {
      ...state.sessionMounts,
      ...Object.fromEntries(SEEDS.map((seed) => [idOf(seed.slug), [mountOf(seed)]])),
    },
    mountBitbucketPr: Object.fromEntries(
      SEEDS.flatMap((seed) => {
        const entry = entryOf({ seed });
        return entry === null ? [] : [[mountIdOf(seed.slug), entry] as const];
      }),
    ),
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
