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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Button } from '@goodboy/ui';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { DeleteSessionConfirm } from '.';

let useAppStore: StoryStore;
const session = aSession({ goal: 'Reconcile the Harborline ledger export' });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ workflows_for_session: () => [] });
  useAppStore.setState({
    sessions: [session],
    currentSessionId: session.id,
    currentWorkspaceId: session.workspaceId,
  });
});

afterEach(cleanup);

const mount = () => {
  const result = render(
    <ToastProvider>
      <DeleteSessionConfirm
        session={session}
        onClose={() => undefined}
        trigger={({ arm }) => <Button onClick={arm}>Delete session</Button>}
      />
    </ToastProvider>,
  );
  const trigger = screen.getByRole('button', { name: 'Delete session' });
  trigger.focus();
  fireEvent.click(trigger);
  return { ...result, trigger };
};

describe('DeleteSessionConfirm', () => {
  it('opens in the portal and explains what is removed and kept', () => {
    useAppStore.setState({ sessionBranches: { [session.id]: 'ledger-core' } });
    const { container } = mount();
    const dialog = screen.getByRole('dialog', { name: `Delete ${session.goal}?` });
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
    expect(container.contains(dialog)).toBe(false);
    within(dialog).getByText('Removed: transcript, file versions, images.');
    within(dialog).getByText('Kept: branches, cost, uncommitted worktrees.');
    within(dialog).getByText('This cannot be undone.');
  });

  it('keeps only cost for a branchless session', () => {
    useAppStore.setState({ sessionBranches: { [session.id]: '' } });
    mount();
    screen.getByText('Kept: cost.');
    expect(screen.queryByText(/Kept: branches/)).toBeNull();
  });

  it('Escape returns focus to the unchanged trigger', async () => {
    const { trigger } = mount();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('archives immediately through the real store and Undo restores the session', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Archive instead' }));
    await waitFor(() => expect(useAppStore.getState().sessions).toEqual([]));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeDefined());
    expect(useAppStore.getState().archivedSessions[session.workspaceId]?.[0]?.id).toBe(session.id);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(useAppStore.getState().sessions[0]?.id).toBe(session.id));
    expect(useAppStore.getState().archivedSessions[session.workspaceId]).toEqual([]);
  });
});
