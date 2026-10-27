// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import { SESSION } from '../../__tests__/helpers/actionFixtures';
import { openFileLink } from './openFileLink';

let useAppStore: StoryStore;

const ROOT = '/work/ledger-core';
const CODE = { binary: 'code', label: 'VS Code' };

const invokes = (command: string): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === command)
    .map(([, args]) => args);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ detect_editors: [CODE], explore_open: null });
  useAppStore.setState({ detectedEditors: [CODE] });
});

describe('openFileLink', () => {
  it('opens a path under the worktree in the editor at its line and column', async () => {
    await openFileLink({
      sessionId: SESSION,
      root: ROOT,
      baseDir: `${ROOT}/packages/api`,
      link: { path: 'src/rounding.ts', line: 42, column: 13 },
    });

    expect(invokes('explore_open')).toEqual([
      {
        sessionDir: ROOT,
        relPath: 'packages/api/src/rounding.ts',
        reveal: false,
        editor: 'code',
        line: 42,
        column: 13,
      },
    ]);
  });

  it('opens nothing for a path outside the worktree', async () => {
    await openFileLink({
      sessionId: SESSION,
      root: ROOT,
      baseDir: ROOT,
      link: { path: '../notify-relay/queue.ts', line: 3, column: null },
    });
    await openFileLink({
      sessionId: SESSION,
      root: ROOT,
      baseDir: ROOT,
      link: { path: '/etc/hosts', line: 1, column: null },
    });

    expect(invokes('explore_open')).toHaveLength(0);
    expect(useAppStore.getState().drawer).toBeNull();
  });

  it('opens the file in Explore at the line when no editor is found', async () => {
    stubStoryInvoke({ detect_editors: [], explore_open: null });
    useAppStore.setState({ detectedEditors: [] });
    await openFileLink({
      sessionId: SESSION,
      root: ROOT,
      baseDir: ROOT,
      link: { path: 'src/rounding.ts', line: 42, column: null },
    });

    expect(invokes('explore_open')).toHaveLength(0);
    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'explore-file',
      sessionId: SESSION,
      payload: { sessionDir: ROOT, line: 42, entry: { relPath: 'src/rounding.ts' } },
    });
  });

  it('leaves the app as it was when the editor handoff fails', async () => {
    stubStoryInvoke({
      detect_editors: [CODE],
      explore_open: () => {
        throw new Error('editor binary not found');
      },
    });
    await openFileLink({
      sessionId: SESSION,
      root: ROOT,
      baseDir: ROOT,
      link: { path: 'src/rounding.ts', line: 1, column: null },
    });

    expect(invokes('explore_open')).toHaveLength(1);
    expect(useAppStore.getState().drawer).toBeNull();
  });
});
