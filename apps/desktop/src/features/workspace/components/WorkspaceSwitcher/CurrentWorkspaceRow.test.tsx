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

import { act } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { harborline, ledgerCore, runningState, sessionOf } from '../../testing/sessionColumn';
import { CurrentWorkspaceRow } from './CurrentWorkspaceRow';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type LabelParams = {
  readonly active: number;
};

const labelFor = ({ active }: LabelParams): string => {
  act(() => {
    useAppStore.setState({
      workspaces: [harborline],
      currentWorkspaceId: harborline.id,
      projects: [ledgerCore],
      sessions: Array.from({ length: active }, (_, index) =>
        sessionOf({ goal: `Reconcile ledger batch ${index + 1}`, state: runningState() }),
      ),
    });
  });
  render(
    <CurrentWorkspaceRow
      workspace={harborline}
      onAddFolder={vi.fn()}
      onManageFolders={vi.fn()}
      onOpenSettings={vi.fn()}
    />,
  );
  return screen.getByText(/1 folder ·/).textContent ?? '';
};

describe('CurrentWorkspaceRow', () => {
  it('counts sessions and calls waiting work active, not running', () => {
    expect(labelFor({ active: 0 })).toBe('1 folder · nothing active');
    cleanup();
    expect(labelFor({ active: 1 })).toBe('1 folder · 1 session active');
    cleanup();
    expect(labelFor({ active: 3 })).toBe('1 folder · 3 sessions active');
  });
});
