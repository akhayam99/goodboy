// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../features/permissions/permissions', async () =>
  (await import('../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../shared/lib/editor', () => ({
  openInEditor: vi.fn(),
  openUrl: vi.fn(),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';

import { WorkspaceLauncher } from '../../features/workspace/components/WorkspaceLauncher';
import { ChatEmptyState } from '../../features/chat/components/ChatView/ChatEmptyState';
import { NotificationCenter } from '../../features/notifications/components/NotificationCenter';
import { BootSplash } from '../../app/components/BootSplash';
vi.mock('../../features/session/hooks/useSessionArchive', () => ({
  useSessionArchive: () => ({
    archive: vi.fn(async () => undefined),
    restore: vi.fn(async () => undefined),
  }),
}));

import { DeleteSessionConfirm } from '../../features/session/components/DeleteSessionConfirm';
import { QuickActionsPopover } from '../../features/quick-actions/QuickActionsPopover';
import { TranscriptCard } from '../../features/chat/components/TranscriptCards';
import { SessionOverviewLoading } from '../../features/session/components/SessionWorkspace/parts/SessionOverviewLoading';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const WS_ID = 'ws-test' as WorkspaceId;
const SESSION_ID = 'sess-1' as SessionId;

describe('empty states', () => {
  it('QuickActionsPopover: empty items', () => {
    render(
      <QuickActionsPopover
        items={[]}
        emptyHint="no workflows yet. create one in workspace settings"
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('no workflows yet. create one in workspace settings')).toBeDefined();
    expect(screen.queryAllByRole('option')).toEqual([]);
  });

  it('NotificationCenter: no notifications', async () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('No notifications yet')).toBeDefined();
  });

  it('Home: no workspace yet, one New workspace door', () => {
    const onNew = vi.fn();
    window.addEventListener('goodboy:add-workspace', onNew);
    render(<WorkspaceLauncher isCreating={false} onCloseCreate={vi.fn()} />);
    screen.getByRole('heading', { name: 'No workspace yet' });
    fireEvent.click(screen.getByRole('button', { name: 'New workspace' }));
    window.removeEventListener('goodboy:add-workspace', onNew);
    expect(onNew).toHaveBeenCalledOnce();
  });

  it('ChatEmptyState: fresh session, set-up-a-workflow CTA', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-start-run', listener);
    render(
      <ChatEmptyState
        sessionId={SESSION_ID}
        selectedAgentId={null}
        phaseRuns={[]}
        hasWorkflow={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /set up a workflow/i }));
    window.removeEventListener('goodboy:open-start-run', listener);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('error states', () => {
  it('App init error, BootSplash with error message', () => {
    render(<BootSplash phase="error" error="database migration failed" />);
    expect(screen.getByRole('alert').textContent).toContain('database migration failed');
  });

  it('DeleteSessionConfirm: error state', async () => {
    const deleteTask = vi.fn().mockRejectedValue(new Error('session not found'));
    const onClose = vi.fn();
    useAppStore.setState({ deleteTask });
    render(
      <DeleteSessionConfirm
        session={aSession({ id: SESSION_ID, workspaceId: WS_ID })}
        onClose={onClose}
        trigger={({ arm }) => (
          <button type="button" onClick={arm}>
            Open delete
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    expect(await screen.findByText(/session not found/)).toBeDefined();
    expect(deleteTask).toHaveBeenCalledWith('sess-1');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('BootSplash: boot-error phase', () => {
    render(<BootSplash phase="error" error="detecting-cli failed" />);
    expect(screen.getByRole('alert').textContent).toContain('detecting-cli failed');
  });

  it('SessionOverviewLoading: silent skeleton before the settle window', () => {
    vi.useFakeTimers();
    render(<SessionOverviewLoading isFreshLayout={false} onRetry={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Loading session overview' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    vi.useRealTimers();
  });

  it('SessionOverviewLoading: retryable failure after the settle window', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    render(<SessionOverviewLoading isFreshLayout={false} onRetry={onRetry} />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('This session did not load')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('TranscriptCard: turn error item', () => {
    render(
      <TranscriptCard
        item={{
          kind: 'error',
          key: 'err-1',
          message: 'provider failed to respond',
        }}
      />,
    );
    expect(screen.getByText('provider failed to respond')).toBeDefined();
    expect(screen.getByTestId('transcript-error-icon')).toBeDefined();
  });
});
