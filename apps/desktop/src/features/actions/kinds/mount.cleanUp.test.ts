// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { AfterMergeOutcome } from '../../../store/slices/branch-cleanup/types';
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import { cleanUpRefusalOf } from './cleanUpRefusalOf';
import { MOUNT_KIND } from './mount';
import type { MountFacts } from './mountFacts';
import { SESSION_CLEANUP_ACTIONS } from './sessionCleanupActions';
import type { SessionFacts } from './session';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-payments' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const mountFacts = (overrides: Partial<MountFacts>): MountFacts => ({
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  projectId: brandId<ProjectId>({ value: 'project-payments' }),
  label: 'hl/fix-duplicate-credit',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  mountBaseBranch: null,
  worktreePath: '/work/payments-api',
  keptPath: '/work/payments-api',
  isRepo: true,
  isClosed: false,
  isBranchGone: false,
  canRestoreBranch: false,
  pr: 'merged',
  requestLabel: 'PR #318',
  requestNumber: 318,
  requestProvider: 'github',
  mergedHeadSha: 'sha-merged',
  createProvider: 'github',
  ahead: 0,
  unpushed: 0,
  behind: 0,
  dirty: 0,
  isDiverged: false,
  onlyOnline: null,
  isRebasing: false,
  rebaseConflict: null,
  autoBlockedReason: null,
  comments: 0,
  canStartTurnsHere: false,
  isScribeWriting: false,
  blockers: [],
  editors: [],
  ...overrides,
});

const cleanUpDefinition = () => {
  const found = MOUNT_KIND.actions.find((action) => action.id === 'mount.cleanUp');
  if (found === undefined) {
    throw new Error('the Clean up action is missing');
  }
  return found;
};

const cleanUpOf = ({ overrides }: { readonly overrides: Partial<MountFacts> }) =>
  resolveActions({ definitions: MOUNT_KIND.actions, facts: mountFacts(overrides) }).find(
    (action) => action.id === 'mount.cleanUp',
  );

type RunParams = {
  readonly outcome: AfterMergeOutcome;
};

const runCleanUp = ({ outcome }: RunParams) => {
  const runAfterMergeCleanup = vi.fn(async () => outcome);
  useAppStore.setState({ runAfterMergeCleanup });
  const result = Promise.resolve(
    cleanUpDefinition().run({ facts: mountFacts({}), env, choice: null }),
  );
  return { runAfterMergeCleanup, result };
};

describe('mount.cleanUp', () => {
  it('is offered inline on a merged branch with a folder, and asks once with what it removes', () => {
    const action = cleanUpOf({ overrides: {} });

    expect(action?.slot).toBe('inline');
    expect(action?.confirm?.goes).toContain('hl/fix-duplicate-credit');
    expect(action?.confirm?.stays).toContain('pull request');
  });

  it.each([
    { name: 'an open pull request', overrides: { pr: 'open' as const } },
    { name: 'a closed pull request', overrides: { pr: 'closed' as const } },
    { name: 'no pull request', overrides: { pr: null } },
    { name: 'a closed folder', overrides: { isClosed: true, worktreePath: null } },
  ])('is not offered for $name', ({ overrides }) => {
    expect(cleanUpOf({ overrides })).toBeUndefined();
  });

  it('asks the store for a requested clean up on the merged head and finishes when it deletes', async () => {
    const { runAfterMergeCleanup, result } = runCleanUp({
      outcome: {
        kind: 'deleted',
        deleted: {
          id: 'deleted-1',
          workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
          projectId: brandId<ProjectId>({ value: 'project-payments' }),
          sessionId: SESSION_ID,
          repoRoot: '/repos/payments-api',
          branch: 'hl/fix-duplicate-credit',
          sha: 'sha-tip',
          keepRef: 'refs/goodboy/deleted/hl/fix-duplicate-credit',
          onOrigin: false,
          deletedAt: brandId<IsoDateTime>({ value: '2026-10-28T10:00:00.000Z' }),
          restoredAt: null,
        },
      },
    });

    await expect(result).resolves.toBeUndefined();
    expect(runAfterMergeCleanup).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      expectedBranch: 'hl/fix-duplicate-credit',
      mergedHeadSha: 'sha-merged',
      isRequested: true,
    });
  });

  it('refuses with a plain sentence when the store skipped the branch', async () => {
    const { result } = runCleanUp({ outcome: { kind: 'skipped' } });

    await expect(result).rejects.toThrow("couldn't check it is safe to remove");
  });

  it('refuses with the reason when the folder holds uncommitted work', async () => {
    const { result } = runCleanUp({
      outcome: {
        kind: 'ask',
        keptBecause: 'Kept hl/fix-duplicate-credit: it has uncommitted changes.',
      },
    });

    await expect(result).rejects.toThrow('it has uncommitted changes');
  });

  it('refuses with the reason when commits are not pushed', async () => {
    const { result } = runCleanUp({
      outcome: {
        kind: 'kept',
        keptBecause: 'Kept hl/fix-duplicate-credit: 2 commits not in the base branch.',
      },
    });

    await expect(result).rejects.toThrow('2 commits not in the base branch');
  });
});

describe('cleanUpRefusalOf', () => {
  it('uses the stored reason, and a plain sentence when there is none', () => {
    expect(
      cleanUpRefusalOf({ outcome: { kind: 'kept', keptBecause: 'Kept a: x.' }, label: 'a' }),
    ).toBe('Kept a: x.');
    expect(cleanUpRefusalOf({ outcome: { kind: 'ask', keptBecause: null }, label: 'a' })).toBe(
      "Kept a: Goodboy couldn't check it is safe to remove.",
    );
  });
});

type SessionParams = {
  readonly ids: ReadonlyArray<string>;
};

const sessionFacts = ({ ids }: SessionParams): SessionFacts => ({
  session: aSession({ id: SESSION_ID }),
  sessionId: SESSION_ID,
  title: 'Stop retried webhooks posting a second credit',
  behindMountIds: [],
  mergedMountIds: ids.map((id) => brandId<MountId>({ value: id })),
  mergedBranches: ids.map((id) => `hl/${id}`),
  rebaseAllRunId: null,
  isRebaseAllRunning: false,
  isArchived: false,
  isPinned: false,
  isRefreshing: false,
  canMovePinUp: false,
  canMovePinDown: false,
  isBranchless: false,
  hasMount: true,
  branch: null,
  worktreePath: null,
  mounts: [],
  worktreePaths: [],
  prUrl: null,
  hasLinkedIssues: false,
  runningAgentCount: 0,
  hasUnread: false,
  canMarkUnread: false,
});

const sessionCleanUpOf = ({ ids }: SessionParams) =>
  resolveActions({ definitions: SESSION_CLEANUP_ACTIONS, facts: sessionFacts({ ids }) });

describe('session.cleanUpMerged', () => {
  it('is offered from two merged branches and counts them', () => {
    expect(sessionCleanUpOf({ ids: ['a'] })).toEqual([]);
    const [action] = sessionCleanUpOf({ ids: ['a', 'b'] });

    expect(action?.shortLabel).toBe('Clean up 2 merged');
    expect(action?.confirm?.items).toEqual(['hl/a', 'hl/b']);
  });
});
