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
    projects: [
      { id: 'project-1', workspaceId: 'workspace-1', rootPath: '/repo', kind: 'repo' },
    ] as ReadonlyArray<Record<string, unknown>>,
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
  h.store.projects = [
    { id: 'project-1', workspaceId: 'workspace-1', rootPath: '/repo', kind: 'repo' },
  ];
});

afterEach(cleanup);

describe('LaunchSessionPanel', () => {
  it('has no workflow setup option and creates the session without a workflow-builder intent', async () => {
    renderPanel();

    expect(screen.queryByRole('checkbox', { name: /Set up workflow next/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Launch session/i }));

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
    const payload = h.createSession.mock.calls[0]?.[0] ?? {};
    expect(payload['openWorkflowBuilder']).toBeUndefined();
    expect(payload).toMatchObject({ externalTasks: [EXTERNAL_TASK] });
  });

  it('launches on the keyboard submit shortcut', async () => {
    renderPanel();

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Session goal' }), {
      key: 'Enter',
      metaKey: true,
    });

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
  });

  it('keeps the branch configuration behind the seeded setup chip', () => {
    renderPanel();

    expect(screen.queryByLabelText('Branch slug')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Session setup/ }));

    expect(screen.getByLabelText('Branch slug').getAttribute('value')).toBe('7-fix-the-flake');
  });

  it('offers the adopt-or-fresh branch choice only when a branch can be adopted', () => {
    const { rerender } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Session setup/ }));
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
    expect(screen.getByRole('button', { name: 'Session setup: ak/fix-the-flake' })).toBeDefined();
  });

  it('keeps a setup region opened by a branch error mounted once the error clears', () => {
    render(
      <LaunchSessionPanel
        workspaceId={WORKSPACE_ID}
        linkedSessionId={null}
        goalSeed="Fix the flake"
        branchSlugSeed="7-fix-the-flake"
        externalTask={EXTERNAL_TASK}
        adoptable={{
          label: 'Continue on PR #12',
          branch: null,
          hint: 'Adopts the branch of PR #12.',
          isResolving: false,
          error: 'PR #12 has no branch',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Session setup/ }).getAttribute('aria-expanded'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: 'Start fresh' }));

    expect(screen.getByRole('tab', { name: 'Start fresh' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByLabelText('Branch slug').getAttribute('value')).toBe('7-fix-the-flake');
  });

  it('blocks launch for invalid folder names in a repo-less workspace', () => {
    h.store.projects = [
      { id: 'project-1', workspaceId: 'workspace-1', rootPath: '/notes', kind: 'folder' },
    ];

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Session setup/ }));
    fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'bad/name' } });

    expect(screen.queryByLabelText('Branch slug')).toBeNull();
    expect(screen.getByText('Use one folder name. Slashes are not allowed')).toBeDefined();
    expect(screen.getByRole('button', { name: /Launch session/i }).getAttribute('disabled')).toBe(
      '',
    );
  });

  it('blocks launch when the folder already exists in a repo-less workspace', async () => {
    h.store.projects = [
      { id: 'project-1', workspaceId: 'workspace-1', rootPath: '/notes', kind: 'folder' },
    ];
    h.simpleSessionDirExists.mockResolvedValueOnce(true);

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Session setup/ }));
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
    h.store.projects = [
      { id: 'project-1', workspaceId: 'workspace-1', rootPath: '/notes', kind: 'folder' },
    ];

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

    fireEvent.click(screen.getByRole('button', { name: /Session setup/ }));

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
