// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getSetting } from '@goodboy/db';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../store/storyHarness';
import { runDefaultKey } from '../../../session/startRun/runDefaultSetting';
import { RunDefaultField } from './RunDefaultField';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Center the member pages' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({ workspaces: [WORKSPACE], sessions: [SESSION] });
});

afterEach(cleanup);

describe('RunDefaultField', () => {
  it('shows only the workspace default outside a session', () => {
    render(<RunDefaultField workspaceId={WORKSPACE.id} />);

    expect(screen.getByRole('tablist', { name: 'New runs start as' })).toBeDefined();
    expect(screen.queryByRole('tablist', { name: 'New runs in this session start as' })).toBeNull();
  });

  it('sets the default of the current session for its new runs, with Undo', async () => {
    useAppStore.setState({ currentSessionId: SESSION.id });
    render(<RunDefaultField workspaceId={WORKSPACE.id} />);

    const row = screen.getByRole('tablist', { name: 'New runs in this session start as' });
    expect(row.parentElement?.parentElement?.textContent).toContain('Center the member pages');
    fireEvent.click(within(row).getByRole('tab', { name: 'Workflow' }));

    await waitFor(async () =>
      expect(
        await getSetting(
          storySqlite(),
          runDefaultKey({ scope: { kind: 'session', sessionId: SESSION.id } }),
        ),
      ).toBe('plan'),
    );
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    expect(
      await getSetting(
        storySqlite(),
        runDefaultKey({ scope: { kind: 'workspace', workspaceId: WORKSPACE.id } }),
      ),
    ).toBeNull();
  });
});
