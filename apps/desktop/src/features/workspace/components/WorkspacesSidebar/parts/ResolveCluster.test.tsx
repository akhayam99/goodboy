import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';

vi.mock('./ResolverRows', () => ({
  ResolverRows: ({ entries }: { entries: ReadonlyArray<{ agent: Agent; status: string }> }) => (
    <>
      {entries.map(({ agent, status }) => (
        <span key={agent.id}>
          {agent.name}:{status}
        </span>
      ))}
    </>
  ),
}));

vi.mock('../../../../../shared/lib/editor', () => ({ openUrl: vi.fn() }));

import { ResolveCluster } from './ResolveCluster';

const SESSION_ID = 'session-1' as SessionId;
const active = {
  id: 'active' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Active resolver',
  status: 'running',
} satisfies Agent;
const completed = {
  id: 'completed' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Completed resolver',
  status: 'completed',
  sourceThreadId: 'PRRT_1',
} satisfies Agent;
const newerActive = {
  ...active,
  id: 'newer-active' as AgentId,
  ordinal: 2,
  name: 'Newer active resolver',
  status: 'pending',
} satisfies Agent;
const newestCompleted = {
  ...completed,
  id: 'newest-completed' as AgentId,
  ordinal: 3,
  name: 'Newest completed resolver',
  sourceThreadId: 'PRRT_2',
} satisfies Agent;
const finishedUnconfirmed = {
  id: 'finished-unconfirmed' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Solo resolver',
  status: 'completed',
} satisfies Agent;

const baseProps = {
  sessionId: SESSION_ID,
  isTaskActive: true,
  prNumber: null,
  pendingThreadIds: new Set<string>(),
  resolverState: {},
  commentByThreadId: new Map(),
  diffCommentByAgentId: new Map(),
  metrics: {
    latestTelemetryByAgentId: new Map(),
    aggregatesByAgentId: new Map(),
    providerUsageByAgentId: new Map(),
    turnsByAgentId: new Map(),
  },
  isTranscriptLoading: false,
  selectedAgentId: null,
  expanded: true,
  onToggle: vi.fn(),
  onSelect: vi.fn(),
  onForceNext: vi.fn(),
  onResolveThread: vi.fn(),
  onResolveAgent: vi.fn(),
};

describe('ResolveCluster', () => {
  afterEach(cleanup);

  it('shows only the active resolvers by default and filters to completed via the segmented tab', () => {
    render(
      <ResolveCluster
        {...baseProps}
        agents={[active, completed, newerActive, newestCompleted]}
        resolvedThreadIds={new Set(['PRRT_1', 'PRRT_2'])}
      />,
    );

    expect(screen.getByText('Newer active resolver:pending')).toBeDefined();
    expect(screen.getByText('Active resolver:running')).toBeDefined();
    expect(screen.queryByText('Completed resolver:resolved')).toBeNull();
    expect(screen.queryByText('Newest completed resolver:resolved')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Completed (2)' }));

    expect(screen.queryByText('Newer active resolver:pending')).toBeNull();
    expect(screen.queryByText('Active resolver:running')).toBeNull();
    expect(screen.getAllByText(/resolver:/).map((row) => row.textContent)).toEqual([
      'Newest completed resolver:resolved',
      'Completed resolver:resolved',
    ]);
  });

  it('opens on Completed by default when there are no active resolvers', () => {
    render(
      <ResolveCluster
        {...baseProps}
        agents={[completed, newestCompleted]}
        resolvedThreadIds={new Set(['PRRT_1', 'PRRT_2'])}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Completed (2)' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getAllByText(/resolver:/).map((row) => row.textContent)).toEqual([
      'Newest completed resolver:resolved',
      'Completed resolver:resolved',
    ]);
  });

  it('does not show a contradictory ratio for a resolver finished without github confirmation', () => {
    const { container } = render(
      <ResolveCluster
        {...baseProps}
        agents={[finishedUnconfirmed]}
        resolvedThreadIds={new Set()}
      />,
    );

    expect(container.textContent).not.toMatch(/\d+\/\d+/);
    expect(screen.getByText('Solo resolver:done')).toBeDefined();
  });

  it('moves from an empty Active view to Completed when the only resolver finishes while mounted', () => {
    const solo = {
      id: 'solo' as AgentId,
      sessionId: SESSION_ID,
      ordinal: 0,
      name: 'Solo resolver',
      status: 'running',
    } satisfies Agent;

    const { rerender } = render(
      <ResolveCluster {...baseProps} agents={[solo]} resolvedThreadIds={new Set()} />,
    );

    expect(screen.getByText('Solo resolver:running')).toBeDefined();
    expect(screen.queryByRole('tablist')).toBeNull();

    const soloDone = {
      ...solo,
      status: 'completed',
      sourceThreadId: 'PRRT_9',
    } satisfies Agent;

    rerender(
      <ResolveCluster {...baseProps} agents={[soloDone]} resolvedThreadIds={new Set(['PRRT_9'])} />,
    );

    expect(screen.getByRole('tab', { name: 'Completed (1)' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByText('Solo resolver:resolved')).toBeDefined();
    expect(screen.queryByText('Solo resolver:running')).toBeNull();
  });

  it('keeps the explicitly selected tab when it still has items after props change', () => {
    const { rerender } = render(
      <ResolveCluster
        {...baseProps}
        agents={[active, completed]}
        resolvedThreadIds={new Set(['PRRT_1'])}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Completed (1)' }));
    expect(screen.getByRole('tab', { name: 'Completed (1)' }).getAttribute('aria-selected')).toBe(
      'true',
    );

    rerender(
      <ResolveCluster
        {...baseProps}
        agents={[active, completed, newerActive]}
        resolvedThreadIds={new Set(['PRRT_1'])}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Completed (1)' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByText('Completed resolver:resolved')).toBeDefined();
  });
});
