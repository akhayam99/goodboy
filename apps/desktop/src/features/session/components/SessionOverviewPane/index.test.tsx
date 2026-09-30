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

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
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
    slotAgents: null as ReadonlySet<string> | null,
    callout: null as boolean | null,
    attention: {
      stage: { stage: 'running', reason: '', attention: null },
      target: null,
    } as Record<string, unknown>,
  },
}));

vi.mock('./useAttentionTarget', () => ({ useAttentionTarget: () => shown.attention }));

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
  NextStepSlot: ({
    shownQuestionIds,
    shownAgentIds,
  }: {
    shownQuestionIds?: ReadonlySet<string>;
    shownAgentIds?: ReadonlySet<string>;
  }) => {
    shown.slot = shownQuestionIds ?? null;
    shown.slotAgents = shownAgentIds ?? null;
    return null;
  },
}));

import { SessionOverviewPane } from './index';

afterEach(() => {
  cleanup();
  shown.reported = new Set();
  shown.slot = null;
  shown.slotAgents = null;
  shown.callout = null;
  shown.attention = {
    stage: { stage: 'running', reason: '', attention: null },
    target: null,
  };
});

const session = (archivedAt: string | null): Session =>
  ({ id: 'sess-1', workspaceId: 'ws-1', goal: 'Untitled session', archivedAt }) as Session;

describe('SessionOverviewPane', () => {
  it('shows the activity of a live session, never a kickoff', () => {
    render(<SessionOverviewPane session={session(null)} onSelectLens={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Activity' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Kickoff' })).toBeNull();
    expect(screen.getByTestId('header')).toBeDefined();
  });

  it('tells the next step which questions the activity already shows', () => {
    shown.reported = new Set(['q-1']);
    render(<SessionOverviewPane session={session(null)} onSelectLens={vi.fn()} />);

    expect([...(shown.slot ?? [])]).toEqual(['q-1']);
    expect(shown.callout).toBe(true);
  });

  it('tells the next step which agent approval the needs-you callout already shows', () => {
    shown.attention = {
      stage: { stage: 'attention', reason: 'Needs approval', attention: 'needs-approval' },
      target: { kind: 'agent', agentId: 'agent-7', home: 'agents', label: 'Answer the approval' },
    };
    render(<SessionOverviewPane session={session(null)} onSelectLens={vi.fn()} />);

    expect([...(shown.slotAgents ?? [])]).toEqual(['agent-7']);
  });

  it('shows the activity of an archived session', () => {
    render(
      <SessionOverviewPane session={session('2026-09-01T00:00:00.000Z')} onSelectLens={vi.fn()} />,
    );

    expect(screen.getByRole('region', { name: 'Activity' })).toBeDefined();
  });
});
