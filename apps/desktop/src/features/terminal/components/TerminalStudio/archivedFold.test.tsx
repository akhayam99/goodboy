// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ARCHIVED_GROUP_KEY, type TerminalGroup } from '../../terminalWorktrees';
import { TerminalGroupSection } from './TerminalGroupSection';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const ARCHIVED: TerminalGroup = {
  key: ARCHIVED_GROUP_KEY,
  kind: 'archived',
  sessionId: null,
  title: 'Archived',
  worktrees: [
    {
      key: 'path:/mock/harborline/payments-api',
      kind: 'path',
      sessionId: null,
      projectId: null,
      projectName: 'payments-api',
      branch: null,
      path: '/mock/harborline/payments-api',
      folder: 'payments-api',
      tabs: [],
    },
  ],
};

const renderGroup = () =>
  render(
    <TerminalGroupSection
      group={ARCHIVED}
      selectedKey={null}
      busyIds={new Set()}
      portsByTerminal={new Map()}
      onSelect={() => undefined}
      onCloseAll={() => undefined}
    />,
  );

describe('the Archived fold of the Terminal page', () => {
  it('stays open when you leave the page and come back', () => {
    const first = renderGroup();
    fireEvent.click(screen.getByRole('button', { name: 'Show 1' }));
    expect(useAppStore.getState().isTerminalArchivedOpen).toBe(true);
    first.unmount();

    renderGroup();

    screen.getByRole('button', { name: 'Hide' });
  });
});
