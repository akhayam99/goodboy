// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import type { WorktreeDepsCheck } from '../../../shared/lib/worktreeDepsCheck';

const SESSION_ID = brandId<SessionId>({ value: 'session-deps' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-deps' });
const WORKTREE = '/w/ledger-core';
const SCRIPT_ID = `deps-install:${MOUNT_ID}`;

const MISSING: WorktreeDepsCheck = {
  state: 'missing',
  command: 'pnpm install --frozen-lockfile',
  source: 'pnpm-lock.yaml',
  folder: 'node_modules',
  isFolderLink: false,
  outside: [],
};

const OUTSIDE: WorktreeDepsCheck = {
  ...MISSING,
  state: 'outside',
  isFolderLink: true,
  outside: ['node_modules'],
};

const READY: WorktreeDepsCheck = { ...MISSING, state: 'ready' };

type RunResult = { readonly stdout: string; readonly stderr: string; readonly exitCode: number };

type Setup = {
  readonly checks: ReadonlyArray<WorktreeDepsCheck>;
  readonly run?: RunResult;
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const setup = ({ checks, run = { stdout: '', stderr: '', exitCode: 0 } }: Setup) => {
  const remaining = [...checks];
  const unlink = vi.fn(async () => ['node_modules']);
  stubStoryInvoke({
    worktree_deps_check: () => remaining.shift() ?? READY,
    worktree_deps_unlink: () => unlink(),
  });
  const runDiscoveredScript = vi.fn(async () => run);
  store.setState({ runDiscoveredScript });
  return { runDiscoveredScript, unlink };
};

const params = { sessionId: SESSION_ID, mountId: MOUNT_ID, worktreePath: WORKTREE };

describe('reinstallWorktreeDeps', () => {
  it('runs the install the lockfile names in that worktree and reports it installed once the check is ready', async () => {
    const { runDiscoveredScript, unlink } = setup({ checks: [MISSING, READY] });

    const result = await store.getState().reinstallWorktreeDeps(params);

    expect(result).toEqual({ kind: 'installed' });
    expect(runDiscoveredScript).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      scriptId: SCRIPT_ID,
      name: 'Reinstall dependencies',
      command: 'pnpm install --frozen-lockfile',
      cwd: WORKTREE,
      mountId: MOUNT_ID,
    });
    expect(unlink).not.toHaveBeenCalled();
  });

  it('removes only the link before it installs when the folder points outside the worktree', async () => {
    const order: string[] = [];
    const { runDiscoveredScript, unlink } = setup({ checks: [OUTSIDE, READY] });
    unlink.mockImplementation(async () => {
      order.push('unlink');
      return ['node_modules'];
    });
    runDiscoveredScript.mockImplementation(async () => {
      order.push('install');
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    const result = await store.getState().reinstallWorktreeDeps(params);

    expect(result).toEqual({ kind: 'installed' });
    expect(order).toEqual(['unlink', 'install']);
  });

  it('does nothing when the worktree already has its dependencies', async () => {
    const { runDiscoveredScript } = setup({ checks: [READY] });

    expect(await store.getState().reinstallWorktreeDeps(params)).toEqual({ kind: 'installed' });
    expect(runDiscoveredScript).not.toHaveBeenCalled();
  });

  it('says why when the install exits with an error and keeps no success', async () => {
    setup({
      checks: [MISSING],
      run: {
        stdout: '',
        stderr: 'resolving\nERR_PNPM_OUTDATED_LOCKFILE lockfile is out of date\n',
        exitCode: 1,
      },
    });

    expect(await store.getState().reinstallWorktreeDeps(params)).toEqual({
      kind: 'failed',
      message: 'ERR_PNPM_OUTDATED_LOCKFILE lockfile is out of date',
    });
  });

  it('does not claim success when the install finished but the check still fails', async () => {
    setup({ checks: [MISSING, MISSING] });

    const result = await store.getState().reinstallWorktreeDeps(params);

    expect(result.kind).toBe('failed');
  });

  it('reports a failed check instead of throwing', async () => {
    stubStoryInvoke({
      worktree_deps_check: () => {
        throw new Error('worktree is gone');
      },
    });

    const result = await store.getState().reinstallWorktreeDeps(params);

    expect(result).toEqual({
      kind: 'failed',
      message: expect.stringContaining('worktree is gone'),
    });
  });

  it('refuses a second install for the same mount while one runs', async () => {
    const { runDiscoveredScript } = setup({ checks: [MISSING] });
    store.setState({
      scriptRuns: {
        [SESSION_ID]: {
          [SCRIPT_ID]: { status: 'pending', result: null, runId: 'run-1', startedAt: 1 },
        },
      },
    });

    expect(await store.getState().reinstallWorktreeDeps(params)).toEqual({ kind: 'busy' });
    expect(runDiscoveredScript).not.toHaveBeenCalled();
  });
});
