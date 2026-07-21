// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { ClusterProgressDashboard } from './ClusterProgressDashboard';
import type { ClusterDashboardItem } from './clusterDashboard';
import { MARKER_ACCENT } from '../marker-accents';

const agent = (over: {
  id: string;
  name?: string;
  status?: Agent['status'];
  outputSummary?: string;
}): Agent =>
  ({
    sessionId: 's1',
    ordinal: 0,
    name: over.name ?? over.id,
    status: over.status ?? 'pending',
    kind: 'implementer',
    ...over,
    id: over.id as AgentId,
  }) as Agent;

const item = (over: {
  id: string;
  index: number;
  status?: Agent['status'];
  instructions?: string | null;
  outputSummary?: string;
}): ClusterDashboardItem => ({
  agent: agent({ id: over.id, status: over.status, outputSummary: over.outputSummary }),
  index: over.index,
  total: 3,
  instructions: over.instructions ?? `do ${over.index}`,
});

const items: ReadonlyArray<ClusterDashboardItem> = [
  item({ id: 'child0', index: 0, status: 'completed', outputSummary: 'built thing 0' }),
  item({ id: 'child1', index: 1, status: 'running' }),
  item({ id: 'child2', index: 2, status: 'pending' }),
];

afterEach(cleanup);

describe('ClusterProgressDashboard', () => {
  it('renders one card per item with the header count', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={items}
        completed={1}
        total={3}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.getByText('cluster progress 1/3')).toBeTruthy();
    expect(screen.getByText('child0')).toBeTruthy();
    expect(screen.getByText('child1')).toBeTruthy();
    expect(screen.getByText('child2')).toBeTruthy();
  });

  it('shows the right status label per status', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={items}
        completed={1}
        total={3}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.getByText('done')).toBeTruthy();
    expect(screen.getByText('running…')).toBeTruthy();
    expect(screen.getByText('queued')).toBeTruthy();
  });

  it('shows outputSummary for completed and instructions otherwise', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={items}
        completed={1}
        total={3}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.getByText('built thing 0')).toBeTruthy();
    expect(screen.getByText('do 1')).toBeTruthy();
  });

  it('fires onSelect with the agent id on click', () => {
    const onSelect = vi.fn();
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={items}
        completed={1}
        total={3}
        selectedAgentId={undefined}
        onSelect={onSelect}
        onAdvance={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('child1'));
    expect(onSelect).toHaveBeenCalledWith('child1');
  });

  it('applies the selected highlight to the active card', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={items}
        completed={1}
        total={3}
        selectedAgentId={'child1' as AgentId}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    const selected = screen.getByText('child1').closest('button');
    expect(selected?.className).toContain(MARKER_ACCENT_BG);
  });

  it('does not highlight cards that are not selected', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={items}
        completed={1}
        total={3}
        selectedAgentId={'child1' as AgentId}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    const other = screen.getByText('child0').closest('button');
    expect(other?.className).not.toContain(MARKER_ACCENT_BG);
  });

  it('labels a failed cluster as stalled', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={[item({ id: 'child0', index: 0, status: 'failed' })]}
        completed={0}
        total={1}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.getByText('stalled')).toBeTruthy();
  });

  it('renders the ordinal badge as index+1 over total per card', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={items}
        completed={1}
        total={3}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(screen.getByText('3/3')).toBeTruthy();
  });

  it('falls back to instructions when a completed cluster has no outputSummary', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={[
          item({ id: 'child0', index: 0, status: 'completed', instructions: 'fallback body' }),
        ]}
        completed={1}
        total={1}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.getByText('fallback body')).toBeTruthy();
  });

  it('renders no body text when there is neither summary nor instructions', () => {
    const bodyless: ClusterDashboardItem = {
      agent: agent({ id: 'lonely', status: 'pending' }),
      index: 0,
      total: 1,
      instructions: null,
    };
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={[bodyless]}
        completed={0}
        total={1}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    const card = screen.getByText('lonely').closest('button');
    expect(card?.querySelector('.line-clamp-2')).toBeNull();
  });

  it('renders only the header when there are no items', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={[]}
        completed={0}
        total={0}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.getByText('cluster progress 0/0')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('tags the container with the session id', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={items}
        completed={1}
        total={3}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.getByTestId('cluster-progress-dashboard').getAttribute('data-session-id')).toBe(
      's1',
    );
  });

  it('shows the advance button while a cluster is still unfinished', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={items}
        completed={1}
        total={3}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.getByTestId('cluster-advance-button')).toBeTruthy();
  });

  it('hides the advance button once every cluster is completed', () => {
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={[item({ id: 'only', index: 0, status: 'completed', outputSummary: 'done' })]}
        completed={1}
        total={1}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('cluster-advance-button')).toBeNull();
  });

  it('requires a confirming second click before advancing the first unfinished cluster', () => {
    const onAdvance = vi.fn();
    render(
      <ClusterProgressDashboard
        sessionId={'s1' as SessionId}
        items={items}
        completed={1}
        total={3}
        selectedAgentId={undefined}
        onSelect={vi.fn()}
        onAdvance={onAdvance}
      />,
    );
    const button = screen.getByTestId('cluster-advance-button');
    fireEvent.click(button);
    expect(onAdvance).not.toHaveBeenCalled();
    expect(screen.getByText('advance without marker?')).toBeTruthy();
    fireEvent.click(button);
    expect(onAdvance).toHaveBeenCalledWith('child1');
  });
});

const MARKER_ACCENT_BG = MARKER_ACCENT.merged.bg;
