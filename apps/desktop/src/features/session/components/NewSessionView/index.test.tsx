import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceGitStatus, WorkspaceId, WorkspaceIntegration } from '@goodboy/types';
import type {
  ClearNewSessionDraftParams,
  NewSessionDraft,
  SetNewSessionDraftParams,
} from '../../../../store/slices/newSessionDrafts/types';

const h = vi.hoisted(() => ({
  remoteKind: 'github' as string | null,
  listLocalBranches: vi.fn(async () => []),
  simpleSessionDirExists: vi.fn(async () => false),
  invoke: vi.fn(),
  showToast: vi.fn(),
  store: {
    providers: [{ id: 'anthropic', connection: 'connected' }],
    workspaces: [
      {
        id: 'workspace-1',
        rootPath: '/repo',
        kind: 'repo' as 'repo' | 'simple',
      },
    ],
    workspaceOverrides: {},
    workspaceGitStatus: {} as Record<string, WorkspaceGitStatus | undefined>,
    loadWorkspaceGitStatus: vi.fn(async () => undefined),
    workspaceIntegrations: {} as Record<string, ReadonlyArray<WorkspaceIntegration>>,
    newSessionDrafts: {} as Record<string, NewSessionDraft | undefined>,
    sessionBranches: {},
    createSession: vi.fn(),
    setCurrentSession: vi.fn(),
    loadSetting: vi.fn(async () => null),
    setNewSessionDraft: vi.fn<(params: SetNewSessionDraftParams) => void>(),
    clearNewSessionDraft: vi.fn<(params: ClearNewSessionDraftParams) => void>(),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.store) => T) => selector(h.store),
  useSessions: () => [],
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock('../../../../features/worktree/useWorkspaceRemoteHostKind', () => ({
  useWorkspaceRemoteHostKind: () => h.remoteKind,
}));

vi.mock('../../../../features/integrations/github/useGithubConnection', () => ({
  useGithubConnection: () => ({
    isAuthenticated: true,
    isResolved: true,
    refresh: vi.fn(async () => undefined),
  }),
}));

vi.mock('../../../../features/worktree/useBranchConflict', () => ({
  useBranchConflict: () => null,
}));

vi.mock('../../../../features/worktree/worktree', () => ({
  listLocalBranches: h.listLocalBranches,
  simpleSessionDirExists: h.simpleSessionDirExists,
  removeWorktree: vi.fn(),
}));

vi.mock('../../../chat/components/ChatInput/hooks/usePendingAttachments', () => ({
  usePendingAttachments: () => ({
    attachments: [],
    isDragging: false,
    composerRef: { current: null },
    fileInputRef: { current: null },
    onFileInputChange: vi.fn(),
    removeAttachment: vi.fn(),
  }),
}));

import { NewSessionView } from './index';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const integration = (provider: 'linear' | 'sentry' | 'gitlab'): WorkspaceIntegration =>
  ({ id: `${provider}-1`, workspaceId: WORKSPACE_ID, provider }) as WorkspaceIntegration;

beforeEach(() => {
  h.remoteKind = 'github';
  h.store.workspaces[0]!.kind = 'repo';
  h.store.workspaceIntegrations = {};
  h.store.workspaceGitStatus = {};
  h.store.loadWorkspaceGitStatus.mockClear();
  h.store.newSessionDrafts = {};
  h.store.createSession.mockReset();
  h.store.setNewSessionDraft.mockClear();
  h.store.setNewSessionDraft.mockImplementation(({ workspaceId, draft }) => {
    h.store.newSessionDrafts[workspaceId] = {
      goal: '',
      branchSlug: '',
      slugTouched: false,
      folderName: '',
      folderNameTouched: false,
      branchMode: 'new',
      existingBranch: '',
      issue: null,
      ...h.store.newSessionDrafts[workspaceId],
      ...draft,
    };
  });
  h.store.clearNewSessionDraft.mockClear();
  h.store.clearNewSessionDraft.mockImplementation(({ workspaceId }) => {
    delete h.store.newSessionDrafts[workspaceId];
  });
  h.listLocalBranches.mockClear();
  h.simpleSessionDirExists.mockClear();
  h.invoke.mockReset();
  h.invoke.mockResolvedValue({
    stdout: JSON.stringify({ result: '<<goal>>Polished goal.<</goal>>' }),
    stderr: '',
    exitCode: 0,
  });
  h.showToast.mockReset();
});

afterEach(cleanup);

describe('NewSessionView issue sources', () => {
  it('isolates expanded edits until Save and supports both keyboard actions', () => {
    h.store.newSessionDrafts = {
      [WORKSPACE_ID]: {
        goal: 'Original goal',
        branchSlug: 'original-goal',
        slugTouched: true,
        folderName: 'Original goal',
        folderNameTouched: false,
        branchMode: 'new',
        existingBranch: '',
        issue: null,
      },
    };
    const onClose = vi.fn();
    render(
      <NewSessionView onClose={onClose} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open goal editor' }));
    fireEvent.change(screen.getByLabelText('Goal editor'), {
      target: { value: 'Discarded edit' },
    });
    fireEvent.keyDown(screen.getByLabelText('Goal editor'), { key: 'Escape' });

    expect(h.store.newSessionDrafts[WORKSPACE_ID]?.goal).toBe('Original goal');
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open goal editor' }));
    fireEvent.change(screen.getByLabelText('Goal editor'), {
      target: { value: 'Saved edit' },
    });
    fireEvent.keyDown(screen.getByLabelText('Goal editor'), {
      key: 'Enter',
      ctrlKey: true,
    });

    expect(h.store.newSessionDrafts[WORKSPACE_ID]?.goal).toBe('Saved edit');
    expect(screen.queryByLabelText('Goal editor')).toBeNull();
  });

  it('keeps the expanded draft after Cancel and shows it again on reopen', () => {
    h.store.newSessionDrafts = {
      [WORKSPACE_ID]: {
        goal: 'Original goal',
        branchSlug: 'original-goal',
        slugTouched: true,
        folderName: 'Original goal',
        folderNameTouched: false,
        branchMode: 'new',
        existingBranch: '',
        issue: null,
      },
    };
    render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open goal editor' }));
    fireEvent.change(screen.getByLabelText('Goal editor'), {
      target: { value: 'Draft in progress' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(h.store.newSessionDrafts[WORKSPACE_ID]?.goal).toBe('Original goal');

    fireEvent.click(screen.getByRole('button', { name: 'Open goal editor' }));
    const editor = screen.getByLabelText('Goal editor');
    if (!(editor instanceof HTMLTextAreaElement)) {
      throw new Error('Expected the expanded goal editor to be a textarea');
    }
    expect(editor.value).toBe('Draft in progress');
  });

  it('reseeds from the goal on reopen when the draft was never edited', () => {
    h.store.newSessionDrafts = {
      [WORKSPACE_ID]: {
        goal: 'Original goal',
        branchSlug: 'original-goal',
        slugTouched: true,
        folderName: 'Original goal',
        folderNameTouched: false,
        branchMode: 'new',
        existingBranch: '',
        issue: null,
      },
    };
    const view = render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open goal editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.change(screen.getByLabelText('Goal'), {
      target: { value: 'Updated elsewhere' },
    });
    view.rerender(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open goal editor' }));
    const editor = screen.getByLabelText('Goal editor');
    if (!(editor instanceof HTMLTextAreaElement)) {
      throw new Error('Expected the expanded goal editor to be a textarea');
    }
    expect(editor.value).toBe('Updated elsewhere');
  });

  it('shows an unsaved-edits badge while the expanded draft is dirty and clears it on save', () => {
    h.store.newSessionDrafts = {
      [WORKSPACE_ID]: {
        goal: 'Original goal',
        branchSlug: 'original-goal',
        slugTouched: true,
        folderName: 'Original goal',
        folderNameTouched: false,
        branchMode: 'new',
        existingBranch: '',
        issue: null,
      },
    };
    render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open goal editor' }));
    fireEvent.change(screen.getByLabelText('Goal editor'), {
      target: { value: 'Draft in progress' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Unsaved edits')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Open goal editor' }));
    fireEvent.keyDown(screen.getByLabelText('Goal editor'), {
      key: 'Enter',
      ctrlKey: true,
    });

    expect(h.store.newSessionDrafts[WORKSPACE_ID]?.goal).toBe('Draft in progress');
    expect(screen.queryByText('Unsaved edits')).toBeNull();
  });

  it('polishes the expanded draft and warns without changing it on failure', async () => {
    h.store.newSessionDrafts = {
      [WORKSPACE_ID]: {
        goal: 'Rough goal',
        branchSlug: 'rough-goal',
        slugTouched: true,
        folderName: 'Rough goal',
        folderNameTouched: false,
        branchMode: 'new',
        existingBranch: '',
        issue: null,
      },
    };
    render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open goal editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Polish' }));

    await waitFor(() => {
      const editor = screen.getByLabelText('Goal editor');
      if (!(editor instanceof HTMLTextAreaElement)) {
        throw new Error('Expected the expanded goal editor to be a textarea');
      }
      expect(editor.value).toBe('Polished goal.');
    });

    fireEvent.change(screen.getByLabelText('Goal editor'), {
      target: { value: 'Keep this wording' },
    });
    h.invoke.mockRejectedValueOnce(new Error('provider unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Polish' }));

    await waitFor(() =>
      expect(h.showToast).toHaveBeenCalledWith(
        'warning',
        'Could not polish the goal, kept your wording',
        { context: 'provider unavailable' },
      ),
    );
    const editor = screen.getByLabelText('Goal editor');
    if (!(editor instanceof HTMLTextAreaElement)) {
      throw new Error('Expected the expanded goal editor to be a textarea');
    }
    expect(editor.value).toBe('Keep this wording');
  });

  it('keeps the draft when the view unmounts and restores it when remounted', () => {
    const view = render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText('Goal'), {
      target: { value: 'Draft a resilient session' },
    });

    view.unmount();

    expect(h.store.clearNewSessionDraft).not.toHaveBeenCalled();
    render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );
    const remountedGoal = screen.getByLabelText('Goal');
    expect(remountedGoal).toBeInstanceOf(HTMLTextAreaElement);
    if (!(remountedGoal instanceof HTMLTextAreaElement)) {
      throw new Error('Expected the goal field to be a textarea');
    }
    expect(remountedGoal.value).toBe('Draft a resilient session');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(h.store.newSessionDrafts[WORKSPACE_ID]).toBeUndefined();
  });

  it('offers every connected source and hides the ones that are not', () => {
    h.store.workspaceIntegrations = {
      [WORKSPACE_ID]: [integration('linear'), integration('sentry')],
    };

    render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    expect(screen.getByText('Start from an issue')).toBeDefined();
    expect(screen.getByRole('tab', { name: /Linear/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Sentry/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /GitHub/ })).toBeDefined();
    expect(screen.queryByRole('tab', { name: /GitLab/ })).toBeNull();
  });

  it('drops the section when nothing is connected', () => {
    h.remoteKind = 'other';

    render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    expect(screen.queryByText('Start from an issue')).toBeNull();
  });

  it('derives the folder name from the goal and stops following after manual edits', () => {
    h.store.workspaces[0]!.kind = 'simple';
    const view = render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    view.rerender(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );
    const initialFolderInput = screen.getByLabelText('Folder name');
    if (!(initialFolderInput instanceof HTMLInputElement)) {
      throw new Error('Expected the folder name field to be an input');
    }
    expect(initialFolderInput.value).toBe('session');

    fireEvent.change(screen.getByLabelText('Goal'), {
      target: { value: 'Prepare for the exam' },
    });
    view.rerender(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );
    view.rerender(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );
    const derivedFolderInput = screen.getByLabelText('Folder name');
    if (!(derivedFolderInput instanceof HTMLInputElement)) {
      throw new Error('Expected the folder name field to be an input');
    }
    expect(derivedFolderInput.value).toBe('Prepare for the exam');

    fireEvent.change(derivedFolderInput, {
      target: { value: 'Exam prep notes' },
    });
    view.rerender(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('Goal'), {
      target: { value: 'Another goal for tomorrow' },
    });
    view.rerender(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );
    const customFolderInput = screen.getByLabelText('Folder name');
    if (!(customFolderInput instanceof HTMLInputElement)) {
      throw new Error('Expected the folder name field to be an input');
    }
    expect(customFolderInput.value).toBe('Exam prep notes');
  });

  it('blocks creation when the folder name is invalid and explains why', () => {
    h.store.workspaces[0]!.kind = 'simple';
    const view = render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('Folder name'), {
      target: { value: 'bad/name' },
    });
    view.rerender(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    expect(screen.getByText('Use one folder name. Slashes are not allowed')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create session' }).getAttribute('disabled')).toBe(
      '',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
    expect(h.store.createSession).not.toHaveBeenCalled();
  });

  it('blocks creation when the folder already exists', async () => {
    h.store.workspaces[0]!.kind = 'simple';
    h.simpleSessionDirExists.mockResolvedValueOnce(true);
    const view = render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('Folder name'), {
      target: { value: 'Existing folder' },
    });
    view.rerender(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    await waitFor(() =>
      expect(h.simpleSessionDirExists).toHaveBeenCalledWith({
        path: '/repo/sessions/Existing folder',
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByText('A folder with this name already exists in this workspace'),
      ).toBeDefined(),
    );
    expect(screen.getByRole('button', { name: 'Create session' }).getAttribute('disabled')).toBe(
      '',
    );
  });

  it('hides issue and branch controls and creates with the typed folder name for simple workspaces', async () => {
    h.store.workspaces[0]!.kind = 'simple';
    h.store.workspaceIntegrations = {
      [WORKSPACE_ID]: [integration('linear'), integration('sentry')],
    };
    const view = render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    expect(screen.queryByText('Start from an issue')).toBeNull();
    expect(screen.queryByText('Branch')).toBeNull();
    expect(screen.queryByLabelText('Branch slug')).toBeNull();
    expect(screen.getByText('Folder')).toBeDefined();
    expect(h.listLocalBranches).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Goal'), {
      target: { value: 'Prepare for the exam' },
    });
    view.rerender(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText('Folder name'), {
      target: { value: 'Exam prep 2026' },
    });
    view.rerender(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );
    await waitFor(() =>
      expect(h.simpleSessionDirExists).toHaveBeenCalledWith({
        path: '/repo/sessions/Exam prep 2026',
      }),
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: 'Create session' }).getAttribute('disabled'),
        ).toBeNull(),
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
    await waitFor(() => expect(h.store.createSession).toHaveBeenCalledOnce());
    const input = h.store.createSession.mock.calls[0]?.[0];
    expect(input).not.toHaveProperty('branchPrefix');
    expect(input).not.toHaveProperty('branchSlug');
    expect(input).not.toHaveProperty('existingBranch');
    expect(input.folderName).toBe('Exam prep 2026');
    expect(h.store.newSessionDrafts[WORKSPACE_ID]).toBeUndefined();
  });
});

const gitStatus = (state: WorkspaceGitStatus['state']): WorkspaceGitStatus => ({
  state,
  branch: null,
  headSubject: null,
  ahead: 0,
  behind: 0,
  staged: 0,
  unstaged: 0,
  untracked: 0,
  changed: 0,
  hasUpstream: false,
});

describe('NewSessionView git gate', () => {
  it('explains the missing repository instead of a form when opened with no git', () => {
    h.store.workspaceGitStatus = { [WORKSPACE_ID]: gitStatus('absent') };

    render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    expect(screen.getByText('A session needs a repository first')).toBeDefined();
    expect(screen.getByText('This folder has no git repository yet')).toBeDefined();
    expect(screen.getByText('git -C "/repo" init -b main')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Create session' })).toBeNull();
  });

  it('explains the missing first commit instead of a form when the repository is unborn', () => {
    h.store.workspaceGitStatus = { [WORKSPACE_ID]: gitStatus('unborn') };

    render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    expect(screen.getByText('A session needs a repository first')).toBeDefined();
    expect(screen.getByText('This repository has no commits yet')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Create session' })).toBeNull();
  });

  it('never reaches createSession from the blocked surface', () => {
    h.store.workspaceGitStatus = { [WORKSPACE_ID]: gitStatus('absent') };
    const onClose = vi.fn();

    render(
      <NewSessionView onClose={onClose} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(h.store.createSession).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders the normal form once the repository is ready', () => {
    h.store.workspaceGitStatus = { [WORKSPACE_ID]: gitStatus('ready') };

    render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    expect(screen.queryByText('A session needs a repository first')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create session' })).toBeDefined();
  });

  it('renders the normal form for a standalone workspace and never polls git', () => {
    h.store.workspaces[0]!.kind = 'simple';
    h.store.workspaceGitStatus = {};

    render(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );

    expect(screen.queryByText('A session needs a repository first')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create session' })).toBeDefined();
    expect(h.store.loadWorkspaceGitStatus).not.toHaveBeenCalled();
  });
});
