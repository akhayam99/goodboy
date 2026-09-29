import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { LaunchExternalTask } from '../../launchSpecFor';

const h = vi.hoisted(() => ({
  linkSessionExternalTask: vi.fn(async () => undefined),
  reportError: vi.fn(async () => undefined),
  sessions: [] as ReadonlyArray<unknown>,
}));

vi.mock('../../../../store', () => {
  const state = () => ({
    sessions: h.sessions,
    linkSessionExternalTask: h.linkSessionExternalTask,
    reportError: h.reportError,
  });
  const useAppStore = <T,>(selector: (value: ReturnType<typeof state>) => T) => selector(state());
  return { useAppStore };
});

const { LinkToSessionPicker } = await import('./index');

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const TASK: LaunchExternalTask = {
  provider: 'linear',
  externalId: 'issue-1',
  identifier: 'CAS-231',
  url: 'https://example.invalid/linear/CAS-231',
  title: 'Refunds on split payments',
};

const session = (id: string, goal: string, updatedAt: string) => ({
  id,
  workspaceId: WORKSPACE_ID,
  goal,
  updatedAt,
});

afterEach(() => {
  cleanup();
  h.sessions = [];
  h.linkSessionExternalTask.mockClear();
});

describe('LinkToSessionPicker', () => {
  it('renders nothing when the workspace has no session to link', () => {
    render(<LinkToSessionPicker workspaceId={WORKSPACE_ID} task={TASK} />);

    expect(screen.queryByRole('combobox', { name: 'Link to a session' })).toBeNull();
  });

  it('fills the panel width so the popup can match the field', () => {
    h.sessions = [session('s1', 'Fix refunds', '2026-09-01T10:00:00Z')];
    render(<LinkToSessionPicker workspaceId={WORKSPACE_ID} task={TASK} />);

    const trigger = screen.getByRole('combobox', { name: 'Link to a session' });

    expect(trigger.className).toContain('w-full');
    expect(trigger.parentElement?.className).toContain('w-full');
  });

  it('sizes the popup to the trigger instead of the default wide popup', () => {
    h.sessions = [session('s1', 'Fix refunds', '2026-09-01T10:00:00Z')];
    render(<LinkToSessionPicker workspaceId={WORKSPACE_ID} task={TASK} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Link to a session' }));

    const popup = screen.getByRole('listbox').closest('[data-dropdown-portal] > div');
    expect(popup?.className).not.toContain('w-max');
    expect(popup instanceof HTMLElement ? popup.style.width : '').not.toBe('');
  });

  it('links the picked session with the record task', async () => {
    h.sessions = [
      session('s1', 'Fix refunds', '2026-09-01T10:00:00Z'),
      session('s2', 'Newer session', '2026-09-02T10:00:00Z'),
    ];
    render(<LinkToSessionPicker workspaceId={WORKSPACE_ID} task={TASK} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Link to a session' }));
    const options = screen.getAllByRole('option');
    expect(options[0]?.textContent).toContain('Newer session');
    fireEvent.click(options[1] as HTMLElement);

    await vi.waitFor(() =>
      expect(h.linkSessionExternalTask).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ externalId: 'issue-1' }),
      ),
    );
  });
});
