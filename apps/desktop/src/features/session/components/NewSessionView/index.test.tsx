import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId, WorkspaceIntegration } from '@goodboy/types';
import type {
  ClearNewSessionDraftParams,
  NewSessionDraft,
  SetNewSessionDraftParams,
} from '../../../../store/slices/newSessionDrafts/types';

const h = vi.hoisted(() => ({
  remoteKind: 'github' as string | null,
  listLocalBranches: vi.fn(async () => []),
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

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.store) => T) => selector(h.store),
  useSessions: () => [],
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
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
  h.store.newSessionDrafts = {};
  h.store.createSession.mockReset();
  h.store.setNewSessionDraft.mockClear();
  h.store.setNewSessionDraft.mockImplementation(({ workspaceId, draft }) => {
    h.store.newSessionDrafts[workspaceId] = {
      goal: '',
      branchSlug: '',
      slugTouched: false,
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
});

afterEach(cleanup);

describe('NewSessionView issue sources', () => {
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

  it('hides issue and branch controls and creates without branch fields for simple workspaces', async () => {
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
    expect(h.listLocalBranches).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Goal'), {
      target: { value: 'Prepare for the exam' },
    });
    view.rerender(
      <NewSessionView onClose={vi.fn()} workspaceId={WORKSPACE_ID} onOpenSettings={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
    await waitFor(() => expect(h.store.createSession).toHaveBeenCalledOnce());
    const input = h.store.createSession.mock.calls[0]?.[0];
    expect(input).not.toHaveProperty('branchPrefix');
    expect(input).not.toHaveProperty('branchSlug');
    expect(input).not.toHaveProperty('existingBranch');
    expect(h.store.newSessionDrafts[WORKSPACE_ID]).toBeUndefined();
  });
});
