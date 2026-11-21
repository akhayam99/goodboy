// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import type { TerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import type { TerminalGroup, TerminalWorktree } from '../../terminalWorktrees';
import { TerminalRail } from './TerminalRail';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const worktreeOf = (folder: string): TerminalWorktree => ({
  key: `path:/mock/harborline/${folder}`,
  kind: 'path',
  sessionId: null,
  projectId: null,
  projectName: folder,
  branch: null,
  path: `/mock/harborline/${folder}`,
  folder,
  tabs: [],
});

const GROUP: TerminalGroup = {
  key: 'workspace',
  kind: 'workspace',
  sessionId: null,
  title: 'Harborline',
  worktrees: [worktreeOf('payments-api'), worktreeOf('ledger-core')],
};

const modelOf = (onSelect: (worktree: TerminalWorktree) => void): TerminalStudioModel => ({
  groups: [GROUP],
  worktree: null,
  tabs: [],
  selected: null,
  targets: [],
  pickerClusters: [],
  folder: null,
  home: null,
  busyIds: new Set<string>(),
  exits: new Map(),
  selectWorktree: onSelect,
  selectTab: () => undefined,
  newTab: () => undefined,
  newTabOn: () => undefined,
  openAt: () => undefined,
  openDefault: () => undefined,
  closeTab: () => undefined,
  closeGroup: () => undefined,
  restartTab: () => undefined,
  renameTab: async () => undefined,
  changeDirectory: () => undefined,
  commandOf: () => null,
});

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the Terminal list keys', () => {
  it('walks the terminals with J and K and opens the one in focus with Enter', async () => {
    const onSelect = vi.fn();
    render(<TerminalRail model={modelOf(onSelect)} portsByTerminal={new Map()} />);
    const user = userEvent.setup();

    await user.keyboard('j');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'payments-api' }));
    await user.keyboard('j');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'ledger-core' }));
    await user.keyboard('k');
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(GROUP.worktrees[0]);
  });
});
