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
import type { FileDiff } from '@goodboy/types';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import {
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { FileWholeDrawer } from './index';

const WORKTREE = '/mock/ledger-core';
const TEXT = Array.from({ length: 100 }, (_, index) => `ledger${index + 1}`).join('\n');
const FILE: FileDiff = {
  path: 'src/ledger-core.ts',
  status: 'modified',
  additions: 1,
  deletions: 1,
  binary: false,
  hunks: [
    {
      header: '@@ -30 +30 @@',
      oldStart: 30,
      newStart: 30,
      oldLines: 1,
      newLines: 1,
      lines: [
        { kind: 'del', oldLine: 30, newLine: null, text: 'ledger30' },
        { kind: 'add', oldLine: null, newLine: 30, text: 'ledger30 changed' },
      ],
    },
  ],
};

const mount = () =>
  render(
    <FileWholeDrawer
      worktreePath={WORKTREE}
      whole={{ file: FILE, oldRev: null, newRev: null, baseBranch: 'main' }}
      onClose={() => undefined}
    />,
  );

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  stubStoryInvoke({ worktree_file_sides: { old: TEXT, new: TEXT, too_large: false } });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('FileWholeDrawer', () => {
  it('opens the whole file with the change marked, from the base the page used', async () => {
    mount();

    expect(await screen.findByText('ledger100')).toBeDefined();
    expect(screen.getByText('ledger1')).toBeDefined();
    expect(screen.getByText('+1')).toBeDefined();
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith(
      'worktree_file_sides',
      expect.objectContaining({ worktreePath: WORKTREE, path: FILE.path, baseBranch: 'main' }),
    );
  });

  it('starts from the Display layout of the page', async () => {
    localStorage.setItem(STORAGE_KEYS.diffLayoutMode, 'split');
    mount();

    expect((await screen.findByRole('tab', { name: 'Split' })).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('switches layout in the drawer without touching the page Display setting', async () => {
    localStorage.setItem(STORAGE_KEYS.diffLayoutMode, 'unified');
    mount();

    fireEvent.click(await screen.findByRole('tab', { name: 'Split' }));

    expect(screen.getByRole('tab', { name: 'Split' }).getAttribute('aria-selected')).toBe('true');
    expect(localStorage.getItem(STORAGE_KEYS.diffLayoutMode)).toBe('unified');
  });
});
