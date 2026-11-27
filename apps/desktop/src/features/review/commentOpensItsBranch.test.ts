// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type DiffComment,
  type MountId,
  type ResolveThread,
  type SessionId,
  type SessionProjectMount,
} from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { gitlabMrFixture } from '../../store/slices/mount-request/testing/gitlabMrFixture';
import type { MountBitbucketPrState } from '../../store/slices/mount-request/state';
import type { BitbucketPullRequest } from '../integrations/bitbucket/client';
import { attentionPlace } from '../session/attentionPlace';
import { ledgerCore, mountGithubOf, mountOf, sessionOf } from '../workspace/testing/sessionColumn';
import { noteThreadId } from '../resolve/notes/noteThread';
import { openReviewComment } from '../resolve/openReviewComment';
import { commentBranchPlaceOf } from './commentBranchPlaceOf';
import { requestReview } from './reviewRequest';

type StoreState = ReturnType<StoryStore['getState']>;

const SESSION = sessionOf({ goal: 'Ledger export' });
const SESSION_ID = brandId<SessionId>({ value: SESSION.id });

const mountNamed = ({ name }: { readonly name: string }): SessionProjectMount => ({
  ...mountOf({ session: SESSION, project: ledgerCore }),
  mountId: brandId<MountId>({ value: `mount-${name}` }),
  worktreePath: `/work/ledger-core-${name}`,
  branch: `hl/${name}`,
});

const FIRST = mountNamed({ name: 'first' });
const GITHUB_MOUNT = mountNamed({ name: 'github' });
const GITLAB_MOUNT = mountNamed({ name: 'gitlab' });
const BITBUCKET_MOUNT = mountNamed({ name: 'bitbucket' });
const NOTE_MOUNT = mountNamed({ name: 'note' });

const GITHUB_PR = 20;
const GITLAB_MR = 31;
const BITBUCKET_PR = 41;

const BITBUCKET_REQUEST: BitbucketPullRequest = {
  id: BITBUCKET_PR,
  title: 'Retry the relay',
  description: '',
  state: 'OPEN',
  createdOn: '2026-09-01T10:00:00Z',
  updatedOn: '2026-09-01T11:00:00Z',
  sourceBranch: BITBUCKET_MOUNT.branch,
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
  webUrl: null,
};

const BITBUCKET_STATE: MountBitbucketPrState = {
  kind: 'bitbucket',
  mountId: BITBUCKET_MOUNT.mountId,
  projectId: ledgerCore.id,
  revision: 1,
  host: 'bitbucket.org',
  repo: null,
  repository: 'harborline/ledger-core',
  branch: BITBUCKET_MOUNT.branch,
  prs: [BITBUCKET_REQUEST],
  links: [],
  checks: null,
  reviewDecision: null,
  pr: BITBUCKET_REQUEST,
  selected: null,
  fetchedAt: TEST_NOW,
  failedAt: null,
  loading: false,
  error: null,
};

const GITLAB_STATE = gitlabMrFixture.mountState({
  mountId: GITLAB_MOUNT.mountId,
  projectId: ledgerCore.id,
  name: 'ledger-core',
  mr: gitlabMrFixture.makeMr({ iid: GITLAB_MR, name: 'ledger-core' }),
});

type ThreadParams = {
  readonly threadId: string;
  readonly sourceKind: 'github' | 'gitlab' | 'bitbucket' | 'local';
  readonly prNumber: number | null;
  readonly state?: ResolveThread['state'];
};

const threadOf = ({
  threadId,
  sourceKind,
  prNumber,
  state = 'needs_answer',
}: ThreadParams): ResolveThread => ({
  id: threadId,
  sessionId: SESSION_ID,
  projectId: ledgerCore.id,
  prNumber,
  threadId,
  originKind: sourceKind === 'local' ? 'diff_comment' : 'review_comment',
  diffCommentId: null,
  state,
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
  sourceKind: sourceKind === 'local' ? 'local' : sourceKind,
});

const NOTE: DiffComment = {
  id: 'note-1',
  sessionId: SESSION_ID,
  filePath: 'src/ledger/export.ts',
  body: 'Name this after the ledger.',
  status: 'open',
  createdAt: TEST_NOW,
  authorKind: 'user',
  projectId: ledgerCore.id,
  branch: NOTE_MOUNT.branch,
};

const DOORS = [
  { host: 'github', thread: 'PRRT_github', mount: GITHUB_MOUNT, number: GITHUB_PR },
  { host: 'gitlab', thread: 'gitlab-discussion-1', mount: GITLAB_MOUNT, number: GITLAB_MR },
  {
    host: 'bitbucket',
    thread: 'bitbucket-comment-1',
    mount: BITBUCKET_MOUNT,
    number: BITBUCKET_PR,
  },
] as const;

let useAppStore: StoryStore;

const targetPathOf = ({ place }: { readonly place: unknown }): string | null => {
  if (!isRecord(place) || !isRecord(place.view) || !isRecord(place.view.target)) {
    return null;
  }
  const { mountPath } = place.view.target;
  return typeof mountPath === 'string' ? mountPath : null;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [SESSION],
    projects: [ledgerCore],
    currentSessionId: SESSION_ID,
    sessionProjectMounts: {
      [SESSION_ID]: [FIRST, GITHUB_MOUNT, GITLAB_MOUNT, BITBUCKET_MOUNT, NOTE_MOUNT],
    },
    sessionActiveMount: { [SESSION_ID]: FIRST.mountId },
    diffMountPath: { [SESSION_ID]: FIRST.worktreePath },
    mountGithub: {
      [FIRST.mountId]: { ...mountGithubOf({ mount: FIRST, number: 10 }), prs: [] },
      [GITHUB_MOUNT.mountId]: {
        ...mountGithubOf({ mount: GITHUB_MOUNT, number: GITHUB_PR }),
        prs: [mountGithubOf({ mount: GITHUB_MOUNT, number: GITHUB_PR }).pr!],
      },
    },
    mountRequests: {
      [GITLAB_MOUNT.mountId]: GITLAB_STATE,
      [BITBUCKET_MOUNT.mountId]: BITBUCKET_STATE,
    },
    diffComments: { [SESSION_ID]: [NOTE] },
    sessionResolveThreads: {
      [SESSION_ID]: [
        ...DOORS.map(({ host, thread, number }) =>
          threadOf({ threadId: thread, sourceKind: host, prNumber: number }),
        ),
        threadOf({
          threadId: noteThreadId({ noteId: NOTE.id }),
          sourceKind: 'local',
          prNumber: null,
        }),
      ],
    },
  });
});

describe('a comment opens on its own branch', () => {
  describe('the Comments tab row', () => {
    it.each(DOORS)('opens a $host comment on the branch the row sits on', ({ thread, mount }) => {
      const navigate = vi.fn<StoreState['navigate']>();

      openReviewComment({
        navigate,
        sessionId: SESSION_ID,
        threadId: thread,
        mountId: mount.mountId,
      });

      const [call] = navigate.mock.calls[0] ?? [];
      expect(targetPathOf({ place: call?.to })).toBe(mount.worktreePath);
      expect(call?.to).toMatchObject({ view: { target: { tab: 'comments', threadId: thread } } });
    });

    it('closes the comment without leaving the branch the list shows', () => {
      const navigate = vi.fn<StoreState['navigate']>();

      openReviewComment({
        navigate,
        sessionId: SESSION_ID,
        threadId: null,
        mountId: GITHUB_MOUNT.mountId,
      });

      expect(targetPathOf({ place: navigate.mock.calls[0]?.[0].to })).toBe(
        GITHUB_MOUNT.worktreePath,
      );
    });
  });

  describe('the session Comments list and the fix panel back link', () => {
    it.each(DOORS)(
      'finds the owning branch of a $host thread when the opener names none',
      ({ thread, mount }) => {
        const navigate = vi.fn<StoreState['navigate']>();

        openReviewComment({ navigate, sessionId: SESSION_ID, threadId: thread });

        expect(targetPathOf({ place: navigate.mock.calls[0]?.[0].to })).toBe(mount.worktreePath);
      },
    );

    it('finds the branch a note was written on', () => {
      const place = commentBranchPlaceOf({
        state: useAppStore.getState(),
        sessionId: SESSION_ID,
        threadId: noteThreadId({ noteId: NOTE.id }),
      });

      expect(targetPathOf({ place })).toBe(NOTE_MOUNT.worktreePath);
    });

    it('stays on the branch on screen when no branch owns the thread', () => {
      const place = commentBranchPlaceOf({
        state: useAppStore.getState(),
        sessionId: SESSION_ID,
        threadId: 'PRRT_unknown',
      });

      expect(targetPathOf({ place })).toBe(FIRST.worktreePath);
    });
  });

  describe('the notification and the board signal', () => {
    it.each(DOORS)(
      'opens the branch of the $host thread that needs you',
      ({ host, thread, mount }) => {
        const only = useAppStore
          .getState()
          .sessionResolveThreads[SESSION_ID]?.filter((row) => row.threadId === thread);
        useAppStore.setState({ sessionResolveThreads: { [SESSION_ID]: only ?? [] } });

        const place = attentionPlace({
          state: useAppStore.getState(),
          sessionId: SESSION_ID,
          reason: 'fix-needs-you',
          subject: 'comment',
        });

        expect(host).not.toBe('');
        expect(targetPathOf({ place })).toBe(mount.worktreePath);
        expect(place).toMatchObject({ view: { target: { tab: 'comments' } } });
      },
    );

    it('opens the branch of a failed push', () => {
      const failed = {
        ...threadOf({ threadId: 'PRRT_github', sourceKind: 'github', prNumber: GITHUB_PR }),
        state: 'failed' as const,
        stateReason: 'publication_failed:network',
      };
      useAppStore.setState({ sessionResolveThreads: { [SESSION_ID]: [failed] } });

      const place = attentionPlace({
        state: useAppStore.getState(),
        sessionId: SESSION_ID,
        reason: 'push-failed',
        subject: 'comment',
      });

      expect(targetPathOf({ place })).toBe(GITHUB_MOUNT.worktreePath);
    });

    it('keeps the branch the notice names', () => {
      const place = attentionPlace({
        state: useAppStore.getState(),
        sessionId: SESSION_ID,
        reason: 'fix-needs-you',
        mountId: BITBUCKET_MOUNT.mountId,
        subject: 'comment',
      });

      expect(targetPathOf({ place })).toBe(BITBUCKET_MOUNT.worktreePath);
    });
  });

  describe('Needs you and Next', () => {
    it.each(DOORS)('opens the branch of the $host thread the fix is for', ({ thread, mount }) => {
      const navigate = vi.fn<StoreState['navigate']>();
      useAppStore.setState({ navigate });

      requestReview({
        getState: useAppStore.getState,
        sessionId: SESSION_ID,
        request: { kind: 'fix', threadIds: [thread] },
      });

      expect(targetPathOf({ place: navigate.mock.calls[0]?.[0].to })).toBe(mount.worktreePath);
    });
  });

  describe('a thread opened by its id', () => {
    it('lands a note on the branch it was written on without naming a branch', async () => {
      const navigate = vi.fn<StoreState['navigate']>();
      useAppStore.setState({
        navigate,
        loadDiffComments: vi.fn(async () => undefined),
        setSessionActiveMount: vi.fn(async () => undefined),
      });

      await useAppStore.getState().openReviewTarget({
        sessionId: SESSION_ID,
        destination: { kind: 'notes', threadIds: [noteThreadId({ noteId: NOTE.id })] },
      });

      expect(targetPathOf({ place: navigate.mock.calls[0]?.[0].to })).toBe(NOTE_MOUNT.worktreePath);
    });
  });
});
