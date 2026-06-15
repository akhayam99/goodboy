// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GitlabWorkspaceIntegration, WorkspaceId, Workspace } from '@goodboy/types';

const { state, currentWorkspace } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    archivedSessions: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<{ connection: string }>,
    setCurrentSession: vi.fn(),
    loadArchivedSessions: vi.fn(),
  },
  currentWorkspace: { id: 'ws-1' as WorkspaceId } as Workspace,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useCurrentWorkspace: () => currentWorkspace,
  useCurrentSession: () => null,
  useSessions: () => [],
  useWorkspaces: () => [currentWorkspace],
  useSessionLoading: () => false,
  useSessionOpenQuestions: () => [],
  useSessionPlans: () => [],
  agentHasUnread: () => false,
  EMPTY_ARRAY: [] as never[],
}));

vi.mock('../../../../shared/lib/theme', () => ({
  useThemeStore: <T,>(selector: (s: { theme: string; toggleTheme: () => void }) => T) =>
    selector({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('../WorkspaceHeader', () => ({ WorkspaceHeader: () => null }));
vi.mock('../SessionActivityBar', () => ({ SessionActivityBar: () => null }));
vi.mock('../SessionDetailPanel', () => ({
  SessionDetailPanel: () => null,
  SessionMetaFooter: () => null,
}));
vi.mock('../WorkspaceLinkDialog', () => ({ WorkspaceLinkDialog: () => null }));
vi.mock('../../../settings/components/GuideDialog', () => ({ GuideDialog: () => null }));
vi.mock('../../../../features/notifications/components/NotificationCenter', () => ({
  NotificationCenter: () => null,
}));
vi.mock('../../../onboarding/OnboardingCard', () => ({ OnboardingChip: () => null }));

const WS_ID = 'ws-1' as WorkspaceId;

const gitlabIntegration: GitlabWorkspaceIntegration = {
  id: 'wi-1' as never,
  workspaceId: WS_ID,
  provider: 'gitlab',
  credentialKey: 'cred-1',
  config: { userName: 'octo', userId: '42', host: 'https://gitlab.com' },
  createdAt: '2026-01-01T00:00:00.000Z' as never,
  updatedAt: '2026-01-01T00:00:00.000Z' as never,
};

const props = {
  onOpenSettings: vi.fn(),
  onOpenPalette: vi.fn(),
  onOpenWorkflows: vi.fn(),
  onOpenLinear: vi.fn(),
  onOpenGitlab: vi.fn(),
  onOpenSentry: vi.fn(),
  onOpenProviders: vi.fn(),
  onOpenGithub: vi.fn(),
  onOpenBudget: vi.fn(),
  onToggleCollapse: vi.fn(),
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.archivedSessions = {};
  state.providers = [];
});
afterEach(cleanup);

import { WorkspacesSidebar } from './index';

describe('WorkspacesSidebar quick-action chips', () => {
  describe('when GitLab is connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [gitlabIntegration] };
    });

    it('shows the GitLab chip and hides the GitHub chip', () => {
      render(<WorkspacesSidebar {...props} />);
      expect(screen.getByText('GitLab')).toBeDefined();
      expect(screen.queryByText('GitHub')).toBeNull();
    });
  });

  describe('when GitLab is not connected', () => {
    it('shows the GitHub chip and hides the GitLab chip', () => {
      render(<WorkspacesSidebar {...props} />);
      expect(screen.getByText('GitHub')).toBeDefined();
      expect(screen.queryByText('GitLab')).toBeNull();
    });
  });
});
