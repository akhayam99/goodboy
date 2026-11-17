// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionMountView,
  type WorktreeStatus,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import { COMMENT_RUN_COPY } from '../../../features/resolve/commentRunCopy';

const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const MOUNT = brandId<MountId>({ value: 'mount-ledger-layout' });
const THREAD = 'PRRT_harborline_ledger_layout';
const STAMP = brandId<IsoDateTime>({ value: '2026-11-17T08:00:00.000Z' });
const REPLY = 'Moved the header into AppLayout, as the payouts route does.';

const MOUNT_VIEW: SessionMountView = {
  id: MOUNT,
  sessionId: SESSION,
  projectId: brandId<ProjectId>({ value: 'project-payments-api' }),
  worktreePath: '/work/payments-api-ledger-layout',
  lastWorktreePath: null,
  branch: 'hl/ledger-layout',
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'payments-api',
  repoSlug: null,
  repoRoot: '/repos/payments-api',
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: STAMP,
  updatedAt: STAMP,
};

type StatusParams = {
  readonly ahead: number;
};

const statusOf = ({ ahead }: StatusParams): WorktreeStatus => ({
  branch: 'hl/ledger-layout',
  head: '6b0e9f1',
  headSubject: 'Move the ledger header into AppLayout',
  upstreamDistance: { kind: 'known', ahead, behind: 0 },
  mainDistance: { kind: 'known', ahead: 3, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/hl/ledger-layout',
  inProgress: null,
});

let useAppStore: StoryStore;

const replyAndResolveThread = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  replyAndResolveThread.mockClear();
  useAppStore.setState({
    sessionMounts: { [SESSION]: [MOUNT_VIEW] },
    replyAndResolveThread,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const reply = (text: string = REPLY) =>
  useAppStore.getState().replyFromCommentRun({
    sessionId: SESSION,
    threadId: THREAD,
    mountId: MOUNT,
    reply: text,
  });

describe('Reply and resolve after a comment run', () => {
  it('posts the reply once every commit of the run is on origin', async () => {
    storySpies.worktreeStatus.mockResolvedValueOnce(statusOf({ ahead: 0 }));

    await reply(`  ${REPLY}  `);

    expect(replyAndResolveThread).toHaveBeenCalledWith({
      sessionId: SESSION,
      threadId: THREAD,
      reply: REPLY,
    });
  });

  it('posts nothing while the run has commits to push', async () => {
    storySpies.worktreeStatus.mockResolvedValueOnce(statusOf({ ahead: 3 }));

    await expect(reply()).rejects.toThrow(COMMENT_RUN_COPY.notPushed);
    expect(replyAndResolveThread).not.toHaveBeenCalled();
  });

  it('posts nothing when the branch cannot be read', async () => {
    storySpies.worktreeStatus.mockRejectedValueOnce(new Error('git status failed'));

    await expect(reply()).rejects.toThrow(COMMENT_RUN_COPY.statusUnread);
    expect(replyAndResolveThread).not.toHaveBeenCalled();
  });

  it('posts nothing for an empty reply', async () => {
    await expect(reply('   ')).rejects.toThrow(COMMENT_RUN_COPY.noReply);
    expect(storySpies.worktreeStatus).not.toHaveBeenCalledWith(MOUNT_VIEW.worktreePath);
    expect(replyAndResolveThread).not.toHaveBeenCalled();
  });
});
