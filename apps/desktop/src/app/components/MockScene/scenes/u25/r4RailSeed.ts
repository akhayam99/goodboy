import type {
  IsoDateTime,
  MountId,
  PrCheckRun,
  PrDetail,
  ProjectId,
  ResolveQueueItemWithThread,
  ResolveThread,
} from '@goodboy/types';
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

type SeedParams = {
  readonly isCardFolded: boolean;
};

export const seedR4Rail = ({ isCardFolded }: SeedParams): void => {
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
};
