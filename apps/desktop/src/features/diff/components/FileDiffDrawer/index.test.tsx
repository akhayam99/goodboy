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
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { aProject, aSession } from '@goodboy/types/testing';
import { mountFixture } from '../../../../__tests__/helpers/actionFixtures';
import {
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { FileDiffDrawer } from './index';

const WORKTREE = '/mock/ledger-core';
const PATCH = [
  'diff --git a/src/ledger-core.ts b/src/ledger-core.ts',
  '--- a/src/ledger-core.ts',
  '+++ b/src/ledger-core.ts',
  '@@ -30 +30 @@',
  '-const ledger = 0;',
  '+const ledger = 1;',
  '',
].join('\n');
const TEXT = Array.from({ length: 100 }, (_, index) => `ledger${index + 1}`).join('\n');

type Params = { readonly baseBranch: string | null };

const mount = async ({ baseBranch }: Params) => {
  const useAppStore = await importStore();
  const target = mountFixture({
    worktreePath: WORKTREE,
    repoRoot: WORKTREE,
    baseBranch: null,
  });
  useAppStore.setState({
    projects: [aProject({ id: target.projectId, rootPath: WORKTREE, baseBranch })],
    sessions: [aSession({ id: target.sessionId })],
    sessionProjectMounts: { [target.sessionId]: [target] },
  });
  render(
    <FileDiffDrawer
      sessionId={target.sessionId}
      source={{ kind: 'worktree', worktreePath: WORKTREE }}
      path="src/ledger-core.ts"
      onClose={() => undefined}
    />,
  );
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ worktree_diff: '' });
});
afterEach(() => {
  cleanup();
});

describe('FileDiffDrawer base branch', () => {
  it('loads the worktree diff against the base the user picked', async () => {
    await mount({ baseBranch: 'develop' });
    await screen.findByText('This file has no changes here.');
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('worktree_diff', {
      worktreePath: WORKTREE,
      baseBranch: 'develop',
    });
  });

  it('keeps the backend default when no base was picked', async () => {
    await mount({ baseBranch: null });
    await screen.findByText('This file has no changes here.');
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('worktree_diff', {
      worktreePath: WORKTREE,
      baseBranch: null,
    });
  });

  it('expands context against the same worktree and chosen base', async () => {
    stubStoryInvoke({
      worktree_diff: PATCH,
      worktree_file_sides: { old: TEXT, new: TEXT, too_large: false },
    });
    await mount({ baseBranch: 'develop' });
    fireEvent.click(await screen.findByRole('button', { name: 'Show all 29 hidden lines' }));
    expect(await screen.findByText('ledger1')).toBeDefined();
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('worktree_file_sides', {
      worktreePath: WORKTREE,
      path: 'src/ledger-core.ts',
      oldRev: null,
      newRev: null,
      baseBranch: 'develop',
    });
  });
});
