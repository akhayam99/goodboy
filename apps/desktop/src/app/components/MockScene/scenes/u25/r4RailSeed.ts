import type {
  IsoDateTime,
  MountId,
  PrCheckRun,
  PrDetail,
  ProjectId,
  PullRequestState,
  PullRequestStateKind,
  ResolveQueueItemWithThread,
  ResolveThread,
  SessionProjectMount,
} from '@goodboy/types';
import type { AppState } from '../../../../../store/types';
import { useAppStore } from '../../../../../store';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import { SESSION_ID } from '../activityRunSeed';
import { mockSceneIpc } from '../mockSceneIpc';
import { handlersFor } from '../brand/DiffStage';
import { BRANCH_FILES_PATCH } from '../brand/contextDiffPatch';

const PAYMENTS_ID = brandedId<ProjectId>({ value: 'mock-run-project-payments-api' });
const BACKFILL_MOUNT = brandedId<MountId>({ value: 'mock-run-mount-payments-backfill' });
const RELAY_MOUNT = brandedId<MountId>({ value: 'mock-run-mount-console' });
const PAYMENTS_MOUNT = brandedId<MountId>({ value: 'mock-run-mount-payments' });
const FETCHED_AT = brandedId<IsoDateTime>({ value: '2026-10-16T09:00:00.000Z' });
const PAYMENTS_WORKTREE = '~/code/harborline/payments-api/.goodboy/worktrees/gb-7k2q9x';
const RELAY_WORKTREE = '~/code/harborline/notify-relay/.goodboy/worktrees/gb-2p6w0z';
const AT = Date.parse('2026-10-16T09:00:00.000Z');

const UNANSWERED: Promise<never> = new Promise<never>(() => undefined);

const DIFF_BY_PATH: Readonly<Record<string, readonly [number, number]>> = {
  [PAYMENTS_WORKTREE]: [652, 99],
  [RELAY_WORKTREE]: [88, 14],
};

type RunParams = {
  readonly name: string;
  readonly conclusion: PrCheckRun['conclusion'];
};

const run = ({ name, conclusion }: RunParams): PrCheckRun => ({
  name,
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

type DetailParams = {
  readonly prNumber: number;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

const detailOf = ({ prNumber, checks }: DetailParams): PrDetail => ({
  prNumber,
  comments: [],
  reviews: [],
  reviewRequests: [],
  checks,
});

type ThreadParams = {
  readonly id: string;
};

const askingThread = ({ id }: ThreadParams): ResolveThread => ({
  id,
  sessionId: SESSION_ID,
  projectId: PAYMENTS_ID,
  prNumber: 318,
  threadId: `${id}-thread`,
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'open',
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
  question: 'Keep the guard in the handler or move it to the queue consumer?',
  replyPostedAt: null,
  replyId: null,
  githubResolved: false,
  closedAt: null,
  closedSource: null,
  createdAt: AT,
  updatedAt: AT,
});

const askingItem = ({ id }: ThreadParams): ResolveQueueItemWithThread => ({
  item: {
    id: `${id}-item`,
    sessionId: SESSION_ID,
    threadId: `${id}-thread`,
    generation: 1,
    reopenedFromItemId: null,
    candidateRevision: 1,
    approvalState: 'none',
    approvedRevision: null,
    approvedReplyHash: null,
    integratedSha: null,
    deferredAt: null,
    deliveredAt: null,
    supersededAt: null,
    createdAt: AT,
    updatedAt: AT,
  },
  thread: askingThread({ id }),
});

const changedFilesAnswer = (payload: unknown): unknown => {
  const path =
    typeof payload === 'object' && payload !== null && 'worktreePath' in payload
      ? payload.worktreePath
      : null;
  const diff = typeof path === 'string' ? DIFF_BY_PATH[path] : undefined;
  if (diff === undefined) {
    return UNANSWERED;
  }
  return { paths: [], entries: [], additions: diff[0], deletions: diff[1], numstat: '' };
};

type ExtraRequest = {
  readonly number: number;
  readonly state: PullRequestStateKind;
  readonly isDraft: boolean;
};

type ExtraBranch = {
  readonly from: MountId;
  readonly id: string;
  readonly branch: string;
  readonly request: ExtraRequest | null;
};

const LONG_BRANCH_DRAFT = 'ak/eng-1200-retry-header-for-notify-relay-with-backoff-draft';

const LONG_BRANCH_QUEUED = 'ak/eng-1200-retry-header-for-notify-relay-with-backoff-queued';

const EXTRA_BRANCHES: ReadonlyArray<ExtraBranch> = [
  {
    from: PAYMENTS_MOUNT,
    id: 'mock-r4-tree-draft',
    branch: LONG_BRANCH_DRAFT,
    request: { number: 322, state: 'open', isDraft: true },
  },
  {
    from: PAYMENTS_MOUNT,
    id: 'mock-r4-tree-queued',
    branch: LONG_BRANCH_QUEUED,
    request: { number: 315, state: 'queued', isDraft: false },
  },
  {
    from: PAYMENTS_MOUNT,
    id: 'mock-r4-tree-closed',
    branch: 'hl/drop-legacy-ledger-hook',
    request: { number: 309, state: 'closed', isDraft: false },
  },
  {
    from: RELAY_MOUNT,
    id: 'mock-r4-tree-approved',
    branch: 'hl/relay-timeout-metrics',
    request: { number: 61, state: 'approved', isDraft: false },
  },
  {
    from: RELAY_MOUNT,
    id: 'mock-r4-tree-none',
    branch: 'hl/banner-copy-pass',
    request: null,
  },
];

type ExtraParams = {
  readonly state: AppState;
};

const extraBranchesOf = ({
  state,
}: ExtraParams): Pick<AppState, 'sessionProjectMounts' | 'mountGithub'> => {
  const mounts = state.sessionProjectMounts[SESSION_ID] ?? [];
  const added = EXTRA_BRANCHES.flatMap((extra, index) => {
    const base = mounts.find((mount) => mount.mountId === extra.from);
    const github = state.mountGithub[extra.from];
    if (base === undefined || github === undefined || github.pr === null) {
      return [];
    }
    const mount: SessionProjectMount = {
      ...base,
      mountId: brandedId<MountId>({ value: extra.id }),
      branch: extra.branch,
      worktreePath: `${base.repoRoot}/.goodboy/worktrees/${extra.id}`,
      parallelIndex: index + 2,
    };
    const pr: PullRequestState | null =
      extra.request === null
        ? null
        : {
            ...github.pr,
            number: extra.request.number,
            state: extra.request.state,
            isDraft: extra.request.isDraft,
            checks: 'success',
            headBranch: extra.branch,
          };
    return [
      {
        mount,
        github: {
          ...github,
          mountId: mount.mountId,
          branch: extra.branch,
          pr,
          prs: pr === null ? [] : [pr],
          detail: null,
        },
      },
    ];
  });
  return {
    sessionProjectMounts: {
      ...state.sessionProjectMounts,
      [SESSION_ID]: [...mounts, ...added.map((entry) => entry.mount)],
    },
    mountGithub: {
      ...state.mountGithub,
      ...Object.fromEntries(added.map((entry) => [entry.mount.mountId, entry.github])),
    },
  };
};

type SeedParams = {
  readonly isCardFolded: boolean;
  readonly hasManyBranches?: boolean;
};

export const seedR4Rail = ({ isCardFolded, hasManyBranches = false }: SeedParams): void => {
  const files = handlersFor(BRANCH_FILES_PATCH);
  mockSceneIpc((command, payload) => {
    if (command === 'worktree_changed_files') {
      return changedFilesAnswer(payload);
    }
    if (command === 'worktree_diff' || command === 'worktree_commits') {
      return files[command]?.(undefined);
    }
    return UNANSWERED;
  });
  try {
    localStorage.setItem(
      STORAGE_KEYS.sessionRailFoldedCards,
      isCardFolded ? '["projects","linked"]' : '[]',
    );
    localStorage.setItem(
      STORAGE_KEYS.sessionRailTreeOpen,
      JSON.stringify(hasManyBranches ? { [SESSION_ID]: { [`branch:${RELAY_MOUNT}`]: true } } : {}),
    );
  } catch {
    return;
  }
  useAppStore.setState((state) => {
    const backfill = state.mountGithub[BACKFILL_MOUNT];
    const relay = state.mountGithub[RELAY_MOUNT];
    const backfillDetail = detailOf({
      prNumber: 318,
      checks: [
        run({ name: 'contract tests', conclusion: 'failure' }),
        run({ name: 'lint', conclusion: 'success' }),
        run({ name: 'unit', conclusion: 'success' }),
      ],
    });
    const sessionGithub = state.sessionGithub[SESSION_ID];
    return {
      ...(sessionGithub === undefined || backfill === undefined
        ? {}
        : {
            sessionGithub: {
              ...state.sessionGithub,
              [SESSION_ID]: { ...sessionGithub, pr: backfill.pr, detail: backfillDetail },
            },
          }),
      mountGithub: {
        ...state.mountGithub,
        ...(backfill === undefined
          ? {}
          : {
              [BACKFILL_MOUNT]: {
                ...backfill,
                detail: backfillDetail,
                detailFetchedAt: FETCHED_AT,
              },
            }),
        ...(relay === undefined
          ? {}
          : {
              [RELAY_MOUNT]: {
                ...relay,
                detail: detailOf({
                  prNumber: 57,
                  checks: [
                    run({ name: 'build', conclusion: 'pending' }),
                    run({ name: 'unit', conclusion: 'pending' }),
                    run({ name: 'lint', conclusion: 'success' }),
                  ],
                }),
                detailFetchedAt: FETCHED_AT,
              },
            }),
      },
      sessionResolveQueueItems: {
        ...state.sessionResolveQueueItems,
        [SESSION_ID]: [
          askingItem({ id: 'mock-r4-rail-ask-1' }),
          askingItem({ id: 'mock-r4-rail-ask-2' }),
        ],
      },
    };
  });
  if (hasManyBranches) {
    useAppStore.setState((state) => extraBranchesOf({ state }));
  }
};
