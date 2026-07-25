import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { WorkspaceId, WorkspaceIntegration } from '@goodboy/types';

const h = vi.hoisted(() => ({
  remoteKind: 'github' as string | null,
  store: {
    providers: [{ id: 'anthropic', connection: 'connected' }],
    workspaces: [{ id: 'workspace-1', rootPath: '/repo' }],
    workspaceOverrides: {},
    workspaceIntegrations: {} as Record<string, ReadonlyArray<WorkspaceIntegration>>,
    sessionBranches: {},
    createSession: vi.fn(),
    setCurrentSession: vi.fn(),
    loadSetting: vi.fn(async () => null),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.store) => T) => selector(h.store),
  useSessions: () => [],
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../../../features/worktree/useRemoteHostKind', () => ({
  useRemoteHostKind: () => h.remoteKind,
}));

vi.mock('../../../../features/worktree/useBranchConflict', () => ({
  useBranchConflict: () => null,
}));

vi.mock('../../../../features/worktree/worktree', () => ({
  listLocalBranches: vi.fn(async () => []),
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
  h.store.workspaceIntegrations = {};
});

afterEach(cleanup);

describe('NewSessionView issue sources', () => {
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
});
