// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({ loadSlotHistory: vi.fn(), toggleDrawer: vi.fn() }),
  useSessionSlots: () => [],
  useSessionLoading: () => ({ slots: false }),
  useSlotHistoryCount: () => 0,
  useSummarizerStatus: () => ({ status: 'idle' }),
}));

vi.mock('../../../../shared/components/PaneShell', () => ({
  PaneShell: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}));

vi.mock('./HeaderBand', () => ({
  HeaderBand: () => <header data-testid="header" />,
}));

const { shown } = vi.hoisted(() => ({
  shown: {
    reported: new Set<string>(),
    slot: null as ReadonlySet<string> | null,
    callout: null as boolean | null,
  },
}));

vi.mock('../SessionWorkspace/parts/TimelinePane', async () => {
  const { useLayoutEffect } = await import('react');
  return {
    TimelinePane: ({
      onShownQuestionsChange,
    }: {
      onShownQuestionsChange?: (ids: ReadonlySet<string>) => void;
    }) => {
      useLayoutEffect(() => {
        onShownQuestionsChange?.(shown.reported);
      }, [onShownQuestionsChange]);
      return <section aria-label="Activity" />;
    },
  };
});

vi.mock('./AttentionCallout', () => ({
  AttentionCallout: ({ isQuestionShownBelow }: { isQuestionShownBelow?: boolean }) => {
    shown.callout = isQuestionShownBelow ?? false;
    return null;
  },
}));
vi.mock('./OverviewActions', () => ({ OverviewActions: () => null }));
vi.mock('../../../suggestions/components/NextStepSlot', () => ({
  NextStepSlot: ({ shownQuestionIds }: { shownQuestionIds?: ReadonlySet<string> }) => {
    shown.slot = shownQuestionIds ?? null;
    return null;
  },
}));

const { setup } = vi.hoisted(() => ({ setup: { isActive: false } }));

vi.mock('../SessionSetup/useSessionSetup', () => ({
  useSessionSetup: () => ({ isActive: setup.isActive, steps: [] }),
}));
vi.mock('../SessionSetup', () => ({
  SessionSetup: () => <section aria-label="Set up" />,
}));

import { SessionOverviewPane } from './index';

afterEach(() => {
  cleanup();
  setup.isActive = false;
  shown.reported = new Set();
  shown.slot = null;
  shown.callout = null;
});

const session = (archivedAt: string | null): Session =>
  ({ id: 'sess-1', workspaceId: 'ws-1', goal: 'Untitled session', archivedAt }) as Session;

describe('SessionOverviewPane', () => {
  it('shows the activity of a live session, never a kickoff', () => {
    render(<SessionOverviewPane session={session(null)} onSelectLens={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Activity' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Set up' })).toBeNull();
    expect(screen.getByTestId('header')).toBeDefined();
  });

  it('tells the next step which questions the activity already shows', () => {
    shown.reported = new Set(['q-1']);
    render(<SessionOverviewPane session={session(null)} onSelectLens={vi.fn()} />);

    expect([...(shown.slot ?? [])]).toEqual(['q-1']);
    expect(shown.callout).toBe(true);
  });

  it('keeps the needs-you callout for questions while setup hides the activity', () => {
    setup.isActive = true;
    render(<SessionOverviewPane session={session(null)} onSelectLens={vi.fn()} />);

    expect(shown.callout).toBe(false);
  });

  it('shows the setup steps instead of the activity while nothing has started', () => {
    setup.isActive = true;
    render(<SessionOverviewPane session={session(null)} onSelectLens={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Set up' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
  });

  it('shows the activity of an archived session', () => {
    render(
      <SessionOverviewPane session={session('2026-09-01T00:00:00.000Z')} onSelectLens={vi.fn()} />,
    );

    expect(screen.getByRole('region', { name: 'Activity' })).toBeDefined();
  });
});
