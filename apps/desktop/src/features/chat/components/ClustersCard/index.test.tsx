// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId } from '@goodboy/types';

const { extractClustersMock, state } = vi.hoisted(() => ({
  extractClustersMock: vi.fn<(text: string) => unknown>(() => null),
  state: {
    selectedAgentId: {} as Record<string, AgentId>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<Agent>>,
    selectAgent: vi.fn(async () => undefined),
  },
}));

vi.mock('@goodboy/core', () => ({ extractClustersFromMarker: extractClustersMock }));
vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { ClustersCard } from './index';

const child = (id: string, ordinal: number, over: Partial<Agent> = {}): Agent =>
  ({
    id: id as AgentId,
    sessionId: 'sess-1',
    name: id,
    status: 'pending',
    kind: 'implementer',
    parentAgentId: 'container' as AgentId,
    ordinal,
    ...over,
  }) as Agent;

const render2 = () => render(<ClustersCard assistantText="x" sessionId={'sess-1' as never} />);

beforeEach(() => {
  extractClustersMock.mockReset();
  state.selectedAgentId = {};
  state.sessionPhaseRuns = {};
  state.selectAgent = vi.fn(async () => undefined);
});
afterEach(cleanup);

describe('ClustersCard', () => {
  it('renders nothing when no clusters detected', () => {
    extractClustersMock.mockReturnValue(null);
    const { container } = render2();
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for empty clusters array', () => {
    extractClustersMock.mockReturnValue([]);
    const { container } = render2();
    expect(container.firstChild).toBeNull();
  });

  it('renders card with cluster count (singular)', () => {
    extractClustersMock.mockReturnValue([{ title: 'Auth refactor', instructions: 'move files' }]);
    render2();
    expect(screen.getByTestId('clusters-card')).toBeTruthy();
    expect(screen.getByText('1 cluster')).toBeTruthy();
  });

  it('renders card with cluster count (plural)', () => {
    extractClustersMock.mockReturnValue([
      { title: 'A', instructions: 'x' },
      { title: 'B', instructions: 'y' },
      { title: 'C', instructions: 'z' },
    ]);
    render2();
    expect(screen.getByText('3 clusters')).toBeTruthy();
  });

  it('falls back to a static, non-clickable list pre-spawn', () => {
    extractClustersMock.mockReturnValue([
      { title: 'First', instructions: 'do first' },
      { title: 'Second', instructions: 'do second' },
    ]);
    render2();
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.getAllByText('planned')).toHaveLength(2);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders live spawned agents and navigates on click', () => {
    extractClustersMock.mockReturnValue([
      { title: 'First', instructions: 'do first' },
      { title: 'Second', instructions: 'do second' },
    ]);
    state.selectedAgentId = { 'sess-1': 'container' as AgentId };
    state.sessionPhaseRuns = {
      'sess-1': [
        child('agent-a', 1, { status: 'running' }),
        child('agent-b', 2, { status: 'completed' }),
      ],
    };
    const reveal = vi.fn();
    window.addEventListener('goodboy:reveal-chat', reveal);
    render2();
    expect(screen.getByText('agent-a')).toBeTruthy();
    expect(screen.getByText('running…')).toBeTruthy();
    expect(screen.getByText('done')).toBeTruthy();
    fireEvent.click(screen.getByText('agent-a'));
    expect(state.selectAgent).toHaveBeenCalledWith('sess-1', 'agent-a');
    expect(reveal).toHaveBeenCalled();
    window.removeEventListener('goodboy:reveal-chat', reveal);
  });
});
