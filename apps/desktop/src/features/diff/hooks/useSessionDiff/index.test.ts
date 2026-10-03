// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { MountId, SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useSessionDiff } from '.';

const WORKTREE = '/repo/ledger-core';
const session = aSession({ goal: 'Check the ledger diff' });
const SESSION_ID = session.id;

type BaseArgs = { readonly worktreePath: string; readonly baseBranch: string | null };

const nameOf = (baseBranch: string | null): string =>
  `against-${(baseBranch ?? 'default').replace('/', '-')}`;

const patchFor = (baseBranch: string | null): string =>
  [
    `diff --git a/${nameOf(baseBranch)}.txt b/${nameOf(baseBranch)}.txt`,
    'index 1111111..2222222 100644',
    `--- a/${nameOf(baseBranch)}.txt`,
    `+++ b/${nameOf(baseBranch)}.txt`,
    '@@ -1 +1 @@',
    '-before',
    '+after',
    '',
  ].join('\n');

const statusFor = (baseBranch: string | null): WorktreeStatus => ({
  branch: nameOf(baseBranch),
  head: 'abc1234',
  headSubject: 'Tighten the refund rounding',
  upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' },
  mainDistance: { kind: 'unknown', reason: 'rev-list-failed' },
  workingTree: { kind: 'unknown', reason: 'status-read-failed' },
  upstream: null,
  inProgress: null,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const openWith = ({
  mountBase,
  projectBase,
}: {
  readonly mountBase: string | null;
  readonly projectBase: string | null;
}) => {
  const project = aProject({ baseBranch: projectBase });
  const mount: SessionProjectMount = {
    mountId: 'mount-ledger' as MountId,
    sessionId: SESSION_ID,
    projectId: project.id,
    mountName: 'ledger-core',
    worktreePath: WORKTREE,
    lastWorktreePath: null,
    repoRoot: WORKTREE,
    branch: 'goodboy/check-ledger',
    baseBranch: mountBase,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 0,
  };
  useAppStore.setState({
    projects: [project],
    sessions: [session],
    sessionProjectMounts: { [SESSION_ID]: [mount] },
  });
  return renderHook(() => useSessionDiff({ sessionId: SESSION_ID, worktreePath: WORKTREE }));
};

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    worktree_diff: ({ baseBranch }: BaseArgs) => patchFor(baseBranch),
    worktree_status: ({ baseBranch }: BaseArgs) => statusFor(baseBranch),
    worktree_commits: [],
  });
});

afterEach(cleanup);

describe('useSessionDiff base branch', () => {
  it('shows the diff and the status against the base the user picked', async () => {
    const { result } = openWith({ mountBase: null, projectBase: 'develop' });

    await waitFor(() =>
      expect(result.current.files.map((file) => file.path)).toEqual(['against-develop.txt']),
    );
    await waitFor(() => expect(result.current.status?.branch).toBe('against-develop'));
  });

  it('prefers the base recorded on the mount', async () => {
    const { result } = openWith({ mountBase: 'release/9', projectBase: 'develop' });

    await waitFor(() =>
      expect(result.current.files.map((file) => file.path)).toEqual(['against-release-9.txt']),
    );
  });

  it('keeps the backend default when the session has no explicit base', async () => {
    const { result } = openWith({ mountBase: null, projectBase: null });

    await waitFor(() =>
      expect(result.current.files.map((file) => file.path)).toEqual(['against-default.txt']),
    );
    await waitFor(() => expect(result.current.status?.branch).toBe('against-default'));
  });
});
