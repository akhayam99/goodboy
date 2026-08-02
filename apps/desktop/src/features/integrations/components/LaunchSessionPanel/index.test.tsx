import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

type CreateSession = (input: Readonly<Record<string, unknown>>) => Promise<{
  session: { id: string; goal: string };
}>;

const h = vi.hoisted(() => ({
  createSession: vi.fn<CreateSession>(async () => ({
    session: { id: 'session-9', goal: 'Fix the flake' },
  })),
  loadSetting: vi.fn(async () => null),
  simpleSessionDirExists: vi.fn(async () => false),
  showToast: vi.fn(),
  store: {
    workspaces: [{ id: 'workspace-1', rootPath: '/repo', kind: 'dev' }] as ReadonlyArray<
      Record<string, unknown>
    >,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (
      state: typeof h.store & {
        createSession: typeof h.createSession;
        loadSetting: typeof h.loadSetting;
      },
    ) => T,
  ) => selector({ ...h.store, createSession: h.createSession, loadSetting: h.loadSetting }),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock('../../../worktree/useBranchConflict', () => ({ useBranchConflict: () => null }));
vi.mock('../../../worktree/worktree', () => ({
  removeWorktree: vi.fn(),
  simpleSessionDirExists: h.simpleSessionDirExists,
}));

import { LaunchSessionPanel } from './index';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const EXTERNAL_TASK = {
  provider: 'gitlab' as const,
  externalId: '71',
  identifier: 'acme/web#7',
  url: 'https://gitlab.com/acme/web/-/issues/7',
  title: 'Fix the flake',
};

const renderPanel = () =>
  render(
    <LaunchSessionPanel
      workspaceId={WORKSPACE_ID}
      linkedSessionId={null}
      goalSeed="Fix the flake"
      branchSlugSeed="7-fix-the-flake"
      externalTask={EXTERNAL_TASK}
      onClose={vi.fn()}
    />,
  );

beforeEach(() => {
  localStorage.clear();
  h.createSession.mockClear();
  h.simpleSessionDirExists.mockClear();
  h.showToast.mockClear();
  h.store.workspaces = [{ id: 'workspace-1', rootPath: '/repo', kind: 'dev' }];
});

afterEach(cleanup);

describe('LaunchSessionPanel', () => {
  it('carries the workflow intent into session creation instead of a deferred event', async () => {
    const events: Array<Event> = [];
    const listener = (event: Event) => events.push(event);
    window.addEventListener('goodboy:open-workflow-builder', listener);

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Launch session/i }));

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
    window.removeEventListener('goodboy:open-workflow-builder', listener);
    expect(h.createSession.mock.calls[0]?.[0]).toMatchObject({
      openWorkflowBuilder: true,
      externalTask: EXTERNAL_TASK,
    });
    expect(events).toHaveLength(0);
  });

  it('drops the workflow intent when the operator turns it off', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('checkbox', { name: /Set up workflow next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Launch session/i }));

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
    expect(h.createSession.mock.calls[0]?.[0]).toMatchObject({ openWorkflowBuilder: false });
  });

  it('offers the adopt-or-fresh branch choice only when a branch can be adopted', () => {
    const { rerender } = renderPanel();
    expect(screen.queryByRole('tab', { name: /Continue on PR #12/ })).toBeNull();

    rerender(
      <LaunchSessionPanel
        workspaceId={WORKSPACE_ID}
        linkedSessionId={null}
        goalSeed="Fix the flake"
        branchSlugSeed="7-fix-the-flake"
        externalTask={EXTERNAL_TASK}
        adoptable={{
          label: 'Continue on PR #12',
          branch: 'ak/fix-the-flake',
          hint: 'Adopts the branch of PR #12.',
          isResolving: false,
          error: null,
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: /Continue on PR #12/ })).toBeDefined();
    expect(screen.getByText('ak/fix-the-flake')).toBeDefined();
  });

  it('blocks launch for invalid folder names in a repo-less workspace', () => {
    h.store.workspaces = [{ id: 'workspace-1', rootPath: '/notes', kind: 'simple' }];

    renderPanel();
    fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'bad/name' } });

    expect(screen.queryByLabelText('Branch slug')).toBeNull();
    expect(screen.getByText('Use one folder name. Slashes are not allowed')).toBeDefined();
    expect(screen.getByRole('button', { name: /Launch session/i }).getAttribute('disabled')).toBe(
      '',
    );
  });

  it('blocks launch when the folder already exists in a repo-less workspace', async () => {
    h.store.workspaces = [{ id: 'workspace-1', rootPath: '/notes', kind: 'simple' }];
    h.simpleSessionDirExists.mockResolvedValueOnce(true);

    renderPanel();
    fireEvent.change(screen.getByLabelText('Folder name'), {
      target: { value: 'Existing folder' },
    });

    await waitFor(() =>
      expect(h.simpleSessionDirExists).toHaveBeenCalledWith({
        path: '/notes/sessions/Existing folder',
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByText('A folder with this name already exists in this workspace'),
      ).toBeDefined(),
    );
    expect(screen.getByRole('button', { name: /Launch session/i }).getAttribute('disabled')).toBe(
      '',
    );
  });

  it('drops the branch field and passes the typed folder name in a repo-less workspace', async () => {
    h.store.workspaces = [{ id: 'workspace-1', rootPath: '/notes', kind: 'simple' }];

    render(
      <LaunchSessionPanel
        workspaceId={WORKSPACE_ID}
        linkedSessionId={null}
        goalSeed="Fix the flake"
        branchSlugSeed="7-fix-the-flake"
        externalTask={EXTERNAL_TASK}
        adoptable={{
          label: 'Continue on PR #12',
          branch: 'ak/fix-the-flake',
          hint: 'Adopts the branch of PR #12.',
          isResolving: false,
          error: null,
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Branch slug')).toBeNull();
    expect(screen.queryByRole('tab', { name: /Continue on PR #12/ })).toBeNull();
    expect(screen.getByText('Folder')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Folder name'), {
      target: { value: 'Issue 7 follow-up' },
    });
    await waitFor(() =>
      expect(h.simpleSessionDirExists).toHaveBeenCalledWith({
        path: '/notes/sessions/Issue 7 follow-up',
      }),
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: /Launch session/i }).getAttribute('disabled'),
        ).toBeNull(),
      { timeout: 2000 },
    );

    fireEvent.click(screen.getByRole('button', { name: /Launch session/i }));

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
    const payload = h.createSession.mock.calls[0]?.[0] ?? {};
    expect(payload.branchPrefix).toBeUndefined();
    expect(payload.branchSlug).toBeUndefined();
    expect(payload.existingBranch).toBeUndefined();
    expect(payload.folderName).toBe('Issue 7 follow-up');
  });
});
