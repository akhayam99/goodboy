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

vi.mock('../SessionWorkspace/parts/TimelinePane', () => ({
  TimelinePane: () => <section aria-label="Activity" />,
}));

vi.mock('./AttentionCallout', () => ({ AttentionCallout: () => null }));
vi.mock('./OverviewActions', () => ({ OverviewActions: () => null }));

import { SessionOverviewPane } from './index';

afterEach(cleanup);

const session = (archivedAt: string | null): Session =>
  ({ id: 'sess-1', workspaceId: 'ws-1', goal: 'Untitled session', archivedAt }) as Session;

describe('SessionOverviewPane', () => {
  it('shows the activity of a live session, never a kickoff', () => {
    render(<SessionOverviewPane session={session(null)} onSelectLens={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Activity' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Kickoff' })).toBeNull();
    expect(screen.getByTestId('header')).toBeDefined();
  });

  it('shows the activity of an archived session', () => {
    render(
      <SessionOverviewPane session={session('2026-09-01T00:00:00.000Z')} onSelectLens={vi.fn()} />,
    );

    expect(screen.getByRole('region', { name: 'Activity' })).toBeDefined();
  });
});
