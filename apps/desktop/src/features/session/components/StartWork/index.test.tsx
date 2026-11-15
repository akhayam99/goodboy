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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { openStartRun } from '../../startRun/openStartRun';
import { StartWork } from '.';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Billing pages' });
const TEXT = 'Stop retried webhooks posting a second credit';

type StoryState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    settings: { 'work.enabled': 'true' },
  });
});

afterEach(() => {
  cleanup();
});

describe('the Start work composer', () => {
  it('names its session, project and branch before you press', () => {
    render(
      <ToastProvider>
        <StartWork
          workspaceId={WORKSPACE.id}
          seed={{ sessionId: null, projectId: null, branch: null, text: TEXT }}
          onClose={vi.fn()}
        />
      </ToastProvider>,
    );
    screen.getByText('New session');
    screen.getByText('No project');
    screen.getByText('New branch');
  });

  it('keeps the composer and its text with the error when the start fails', async () => {
    useAppStore.setState({
      spawnAgent: vi
        .fn<StoryState['spawnAgent']>()
        .mockRejectedValue(new Error('No provider is connected')),
    });
    const onClose = vi.fn();
    render(
      <ToastProvider>
        <StartWork
          workspaceId={WORKSPACE.id}
          seed={{ sessionId: SESSION.id, projectId: null, branch: null, text: TEXT }}
          onClose={onClose}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No provider'));
    expect(onClose).not.toHaveBeenCalled();
    screen.getByDisplayValue(TEXT);
  });
});

describe('the start door', () => {
  it('opens the composer with the switch on and the router with it off', () => {
    openStartRun({ sessionId: SESSION.id, text: TEXT });
    expect(useAppStore.getState().workStart).toEqual({
      sessionId: SESSION.id,
      projectId: null,
      branch: null,
      text: TEXT,
    });
    useAppStore.setState({ workStart: null, settings: { 'work.enabled': 'false' } });
    openStartRun({ sessionId: SESSION.id, text: TEXT });
    expect(useAppStore.getState().workStart).toBeNull();
  });
});
