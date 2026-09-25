// @vitest-environment happy-dom

import { useEffect, type ReactNode } from 'react';
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
  HeaderBand: ({ isEmpty }: { isEmpty?: boolean }) => (
    <header data-testid="header" data-empty={String(isEmpty ?? false)} />
  ),
}));

vi.mock('../SessionWorkspace/parts/TimelinePane', () => ({
  TimelinePane: ({
    kickoff,
    onKickoffShownChange,
  }: {
    kickoff?: ReactNode;
    onKickoffShownChange?: (isShown: boolean) => void;
  }) => {
    useEffect(() => {
      onKickoffShownChange?.(kickoff != null);
    }, [kickoff, onKickoffShownChange]);
    return <>{kickoff ?? <section aria-label="Activity" />}</>;
  },
}));

vi.mock('../SessionKickoff', () => ({
  SessionKickoff: () => <section aria-label="Kickoff" />,
}));
vi.mock('../SessionKickoff/IssueBriefProposal', () => ({ IssueBriefProposal: () => null }));
vi.mock('./useIssueBriefProposal', () => ({
  useIssueBriefProposal: () => ({ proposal: null, pickIssue: vi.fn() }),
}));
vi.mock('./AttentionCallout', () => ({ AttentionCallout: () => null }));
vi.mock('./GoalOverviewRegion', () => ({ GoalOverviewRegion: () => null }));
vi.mock('./GoalDetailAction', () => ({ GoalDetailAction: () => null }));
vi.mock('./OverviewActions', () => ({ OverviewActions: () => null }));

import { SessionOverviewPane } from './index';

afterEach(cleanup);

const session = (archivedAt: string | null): Session =>
  ({ id: 'sess-1', workspaceId: 'ws-1', goal: 'Untitled session', archivedAt }) as Session;

describe('SessionOverviewPane', () => {
  it('asks how to start on an empty live session and trims its header', () => {
    render(<SessionOverviewPane session={session(null)} onSelectLens={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Kickoff' })).toBeDefined();
    expect(screen.getByTestId('header').getAttribute('data-empty')).toBe('true');
  });

  it('shows no kickoff on an archived session', () => {
    render(
      <SessionOverviewPane session={session('2026-09-01T00:00:00.000Z')} onSelectLens={vi.fn()} />,
    );

    expect(screen.queryByRole('region', { name: 'Kickoff' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Activity' })).toBeDefined();
    expect(screen.getByTestId('header').getAttribute('data-empty')).toBe('false');
  });
});
