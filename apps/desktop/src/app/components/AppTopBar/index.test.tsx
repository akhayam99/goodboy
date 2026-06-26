import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Workspace, WorkspaceId } from '@goodboy/types';

const { currentWorkspace } = vi.hoisted(() => ({
  currentWorkspace: { id: 'ws-1' as WorkspaceId, name: 'Test WS' } as Workspace,
}));

vi.mock('../../../store', () => ({
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

afterEach(cleanup);

import { AppTopBar } from './index';

describe('AppTopBar', () => {
  it('renders settings button', () => {
    render(<AppTopBar onOpenSettings={vi.fn()} activeStudio={null} />);
    expect(screen.getByRole('button', { name: 'open settings' })).toBeDefined();
  });

  it('settings button has active state when settings studio is open', () => {
    render(<AppTopBar onOpenSettings={vi.fn()} activeStudio="settings" />);
    const btn = screen.getByRole('button', { name: 'open settings' });
    expect(btn.className).toContain('bg-foreground');
  });

  it('settings button is normal when a different studio is open', () => {
    render(<AppTopBar onOpenSettings={vi.fn()} activeStudio="workflow" />);
    const btn = screen.getByRole('button', { name: 'open settings' });
    expect(btn.className).not.toContain('bg-foreground');
  });
});
