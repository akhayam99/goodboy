// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../store/storyHarness';
import { ExploreFileChanges } from './ExploreFileChanges';

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

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    worktree_diff: PATCH,
    worktree_file_sides: { old: TEXT, new: TEXT, too_large: false },
  });
});
afterEach(() => {
  cleanup();
});

describe('ExploreFileChanges context gaps', () => {
  it('expands hidden lines from the file sides of this worktree and base branch', async () => {
    render(
      <ExploreFileChanges
        sessionDir={WORKTREE}
        relPath="src/ledger-core.ts"
        baseBranch="develop"
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Show 29 lines' }));
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
