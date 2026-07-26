import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId, Workspace, WorkspaceId } from '@goodboy/types';

const { currentWorkspace, hooks, store } = vi.hoisted(() => {
  const workspace = { id: 'ws-1' as WorkspaceId, name: 'Test WS' } as Workspace;
  return {
    currentWorkspace: workspace,
    hooks: {
      sessions: [] as ReadonlyArray<Session>,
      groups: [] as ReadonlyArray<{
        readonly key: string;
        readonly sessions: ReadonlyArray<Session>;
      }>,
      rollup: { attentionCount: 0, runningCount: 0, todaySpend: 0 },
      reasons: {} as Record<string, string>,
    },
    store: {
      setCurrentSession: vi.fn(async () => undefined),
      setActiveLens: vi.fn(),
    },
  };
});

vi.mock('../../../store', () => ({
  useCurrentWorkspace: () => currentWorkspace,
  useSessions: () => hooks.sessions,
  useWorkspaceRollup: () => hooks.rollup,
  useStageGroupedSessions: () => hooks.groups,
  useSessionStageInfo: (session: Session) => ({
    stage: 'attention',
    reason: hooks.reasons[session.id] ?? 'Needs attention',
  }),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
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

beforeEach(() => {
  hooks.sessions = [];
  hooks.groups = [];
  hooks.rollup = { attentionCount: 0, runningCount: 0, todaySpend: 0 };
  hooks.reasons = {};
  store.setCurrentSession.mockClear();
  store.setActiveLens.mockClear();
});

afterEach(cleanup);

import { AppTopBar } from './index';

const ATTENTION_SESSION_ID = 'session-1' as SessionId;
const ATTENTION_SESSION = {
  id: ATTENTION_SESSION_ID,
  goal: 'Review the failing checks',
} as unknown as Session;

describe('AppTopBar', () => {
  it('renders settings button', () => {
    render(<AppTopBar onOpenSettings={vi.fn()} onOpenBudget={vi.fn()} activeStudio={null} />);
    expect(screen.getByRole('button', { name: 'open settings' })).toBeDefined();
  });

  it('settings button has active state when settings studio is open', () => {
    render(<AppTopBar onOpenSettings={vi.fn()} onOpenBudget={vi.fn()} activeStudio="settings" />);
    const btn = screen.getByRole('button', { name: 'open settings' });
    expect(btn.className).toContain('bg-foreground');
  });

  it('settings button is normal when a different studio is open', () => {
    render(<AppTopBar onOpenSettings={vi.fn()} onOpenBudget={vi.fn()} activeStudio="workflow" />);
    const btn = screen.getByRole('button', { name: 'open settings' });
    expect(btn.className).not.toContain('bg-foreground');
  });

  it('opens budget only from the spend target and omits the beta chip', () => {
    hooks.sessions = [ATTENTION_SESSION];
    hooks.groups = [{ key: 'attention', sessions: [ATTENTION_SESSION] }];
    hooks.rollup = { attentionCount: 1, runningCount: 0, todaySpend: 2.5 };
    const onOpenBudget = vi.fn();
    render(<AppTopBar onOpenSettings={vi.fn()} onOpenBudget={onOpenBudget} activeStudio={null} />);

    fireEvent.click(screen.getByTitle("Today's spend across providers, open budget"));
    expect(onOpenBudget).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: '1 session needs you' }));
    expect(onOpenBudget).toHaveBeenCalledOnce();
    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('lists attention sessions and navigates from the needs-you popover', () => {
    hooks.sessions = [ATTENTION_SESSION];
    hooks.groups = [{ key: 'attention', sessions: [ATTENTION_SESSION] }];
    hooks.rollup = { attentionCount: 1, runningCount: 0, todaySpend: 0 };
    hooks.reasons = { [ATTENTION_SESSION_ID]: 'PR #42: CI failed' };
    render(<AppTopBar onOpenSettings={vi.fn()} onOpenBudget={vi.fn()} activeStudio={null} />);

    fireEvent.click(screen.getByRole('button', { name: '1 session needs you' }));

    expect(screen.getByText('Needs you')).toBeDefined();
    expect(screen.getByRole('list', { name: 'Sessions needing attention' })).toBeDefined();
    expect(screen.getByText('Review the failing checks')).toBeDefined();
    expect(screen.getByText('PR #42: CI failed')).toBeDefined();

    fireEvent.click(screen.getByTitle('Review the failing checks · PR #42: CI failed'));

    expect(store.setCurrentSession).toHaveBeenCalledWith(ATTENTION_SESSION_ID);
    expect(screen.queryByText('PR #42: CI failed')).toBeNull();
  });
});
