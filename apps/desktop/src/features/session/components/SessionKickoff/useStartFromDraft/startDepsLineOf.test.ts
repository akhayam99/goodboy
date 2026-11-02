vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { startDepsLineOf } from './startDepsLineOf';

const TARGET = { repoRoot: '/work/notify-relay', worktreePath: '/work/notify-relay-wt' };

const checkOf = (state: string) => ({
  state,
  command: 'pnpm install',
  source: 'pnpm-lock.yaml',
  folder: 'node_modules',
  isFolderLink: true,
  outside: [],
});

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('startDepsLineOf', () => {
  it('says node_modules is linked elsewhere when the check finds Outside', async () => {
    const asked: Array<unknown> = [];
    stubStoryInvoke({
      worktree_deps_check: (args: unknown) => {
        asked.push(args);
        return checkOf('outside');
      },
    });

    await expect(startDepsLineOf({ targets: [TARGET] })).resolves.toBe(
      'node_modules is linked to another folder: reinstall before the agent runs checks.',
    );
    expect(asked).toEqual([{ repoPath: TARGET.repoRoot, worktreePath: TARGET.worktreePath }]);
  });

  it('adds no line when the dependencies are ready', async () => {
    stubStoryInvoke({ worktree_deps_check: checkOf('ready') });

    await expect(startDepsLineOf({ targets: [TARGET] })).resolves.toBeNull();
  });

  it('adds no line, and never fails the start, when the check itself fails', async () => {
    stubStoryInvoke({
      worktree_deps_check: () => {
        throw { kind: 'io', message: 'the folder is locked' };
      },
    });

    await expect(startDepsLineOf({ targets: [TARGET] })).resolves.toBeNull();
  });

  it('skips a mount that has no worktree yet', async () => {
    stubStoryInvoke({ worktree_deps_check: checkOf('outside') });

    await expect(
      startDepsLineOf({ targets: [{ repoRoot: TARGET.repoRoot, worktreePath: '' }] }),
    ).resolves.toBeNull();
  });
});
