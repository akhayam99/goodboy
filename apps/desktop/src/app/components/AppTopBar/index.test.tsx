import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GitlabWorkspaceIntegration, Workspace, WorkspaceId } from '@goodboy/types';

const { state, currentWorkspace } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<{ connection: string }>,
  },
  currentWorkspace: { id: 'ws-1' as WorkspaceId, name: 'Test WS' } as Workspace,
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useCurrentWorkspace: () => currentWorkspace,
  useSessions: () => [],
  useWorkspaceRollup: () => ({ attentionCount: 0, runningCount: 0, todaySpend: 0 }),
}));

vi.mock('../../../shared/lib/theme', () => ({
  useThemeStore: <T,>(selector: (s: { theme: string; toggleTheme: () => void }) => T) =>
    selector({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('../../../features/companion/bridge', () => ({
  bridgeStatus: () => Promise.resolve({ running: false, enrolledCount: 0 }),
}));

vi.mock('../../../features/updater/components/UpdateIndicator', () => ({
  UpdateIndicator: () => null,
}));

vi.mock('../../../features/notifications/components/NotificationCenter', () => ({
  NotificationCenter: () => null,
}));

vi.mock('../../../features/onboarding/OnboardingCard', () => ({
  OnboardingChip: () => null,
}));

vi.mock('../../../shared/components/DogMascot', () => ({
  DogMascot: () => null,
}));

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

const baseProps = {
  breadcrumb: [],
  onOpenSettings: vi.fn(),
  onOpenPalette: vi.fn(),
  onOpenWorkflows: vi.fn(),
  onOpenLinear: vi.fn(),
  onOpenSentry: vi.fn(),
  onOpenGitlab: vi.fn(),
  onOpenProviders: vi.fn(),
  onOpenGithub: vi.fn(),
  onOpenBudget: vi.fn(),
};

beforeEach(() => {
  state.workspaceIntegrations = {};
  state.providers = [];
});
afterEach(cleanup);

import { AppTopBar } from './index';

describe('AppTopBar quick-action chips', () => {
  describe('when GitLab is connected', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [gitlabIntegration] };
    });

    it('shows the GitLab chip and hides the GitHub chip', () => {
      render(<AppTopBar {...baseProps} />);
      expect(screen.getByTitle('launch a session from a GitLab issue')).toBeDefined();
      expect(
        screen.queryByTitle('review and act on pull requests across this workspace'),
      ).toBeNull();
    });
  });

  describe('when GitLab is not connected', () => {
    it('shows the GitHub chip and hides the GitLab chip', () => {
      render(<AppTopBar {...baseProps} />);
      expect(
        screen.getByTitle('review and act on pull requests across this workspace'),
      ).toBeDefined();
      expect(screen.queryByTitle('launch a session from a GitLab issue')).toBeNull();
    });
  });
});
