// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: [] as never[],
  agentHasUnread: (agent: Agent, isCurrentlyViewed: boolean): boolean => {
    if (isCurrentlyViewed || agent.status === 'skipped' || !agent.lastFinishedAt) {
      return false;
    }
    return !agent.lastViewedAt || agent.lastFinishedAt > agent.lastViewedAt;
  },
}));

vi.mock('./ClusterChildRow', () => ({
  ClusterChildRow: ({ child }: { child: Agent }) => (
    <div data-testid="cluster-child-row">{child.name}</div>
  ),
}));

import { ScoutSubtree } from './ScoutSubtree';

const SESSION_ID = 'session-1' as SessionId;
const NOW = '2026-06-16T00:00:00.000Z' as IsoDateTime;
const CONTAINER = 'container' as AgentId;

function buildAgent(overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent {
  return {
    sessionId: SESSION_ID,
    ordinal: 0,
    name: overrides.id,
    status: 'completed',
    kind: 'scout',
    ...overrides,
  };
}

function renderTree(
  childrenByParentId: Map<string, Agent[]>,
  opts: {
    expanded?: boolean;
    selectedAgentId?: AgentId | null;
    isTaskActive?: boolean;
    variant?: 'sidebar' | 'detail';
  } = {},
) {
  const expandState = new Map<string, boolean>([[CONTAINER, opts.expanded ?? false]]);
  return render(
    <ScoutSubtree
      containerId={CONTAINER}
      depth={0}
      childrenByParentId={childrenByParentId}
      aggregatesByAgentId={new Map()}
      selectedAgentId={opts.selectedAgentId ?? null}
      isTaskActive={opts.isTaskActive ?? true}
      expandState={expandState}
      onToggle={vi.fn()}
      onSelect={vi.fn()}
      variant={opts.variant}
    />,
  );
}

describe('ScoutSubtree unread badge', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders nothing when the container has no children', () => {
    const { container } = render(
      <ScoutSubtree
        containerId={CONTAINER}
        depth={0}
        childrenByParentId={new Map()}
        aggregatesByAgentId={new Map()}
        selectedAgentId={null}
        isTaskActive
        expandState={new Map()}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows a badge counting unread direct children when collapsed', () => {
    const map = new Map<string, Agent[]>([
      [
        CONTAINER,
        [
          buildAgent({ id: 's1' as AgentId, lastFinishedAt: NOW }),
          buildAgent({ id: 's2' as AgentId, lastFinishedAt: NOW }),
        ],
      ],
    ]);
    renderTree(map, { expanded: false });
    expect(screen.getByTitle('2 scout replies to review').textContent).toContain('2');
  });

  it('counts nested grandchildren in the badge total', () => {
    const map = new Map<string, Agent[]>([
      [CONTAINER, [buildAgent({ id: 's1' as AgentId, lastFinishedAt: NOW })]],
      [
        's1',
        [
          buildAgent({ id: 'g1' as AgentId, parentAgentId: 's1' as AgentId, lastFinishedAt: NOW }),
          buildAgent({ id: 'g2' as AgentId, parentAgentId: 's1' as AgentId, lastFinishedAt: NOW }),
        ],
      ],
    ]);
    renderTree(map, { expanded: false });
    expect(screen.getByTitle('3 scout replies to review').textContent).toContain('3');
  });

  it('uses singular wording for a single unread scout', () => {
    const map = new Map<string, Agent[]>([
      [CONTAINER, [buildAgent({ id: 's1' as AgentId, lastFinishedAt: NOW })]],
    ]);
    renderTree(map, { expanded: false });
    expect(screen.queryByTitle('1 scout reply to review')).not.toBeNull();
  });

  it('excludes skipped descendants from the count', () => {
    const map = new Map<string, Agent[]>([
      [
        CONTAINER,
        [
          buildAgent({ id: 's1' as AgentId, lastFinishedAt: NOW }),
          buildAgent({ id: 's2' as AgentId, status: 'skipped', lastFinishedAt: NOW }),
        ],
      ],
    ]);
    renderTree(map, { expanded: false });
    expect(screen.queryByTitle('1 scout reply to review')).not.toBeNull();
    expect(screen.queryByTitle('2 scout replies to review')).toBeNull();
  });

  it('excludes the currently-viewed selected child from the count', () => {
    const map = new Map<string, Agent[]>([
      [
        CONTAINER,
        [
          buildAgent({ id: 's1' as AgentId, lastFinishedAt: NOW }),
          buildAgent({ id: 's2' as AgentId, lastFinishedAt: NOW }),
        ],
      ],
    ]);
    renderTree(map, { expanded: false, selectedAgentId: 's1' as AgentId, isTaskActive: true });
    expect(screen.queryByTitle('1 scout reply to review')).not.toBeNull();
  });

  it('hides the badge and renders child rows when expanded', () => {
    const map = new Map<string, Agent[]>([
      [
        CONTAINER,
        [
          buildAgent({ id: 's1' as AgentId, lastFinishedAt: NOW }),
          buildAgent({ id: 's2' as AgentId, lastFinishedAt: NOW }),
        ],
      ],
    ]);
    renderTree(map, { expanded: true });
    expect(screen.queryByTitle('2 scout replies to review')).toBeNull();
    expect(screen.getAllByTestId('cluster-child-row')).toHaveLength(2);
  });

  it('shows no badge when every finished child was already viewed', () => {
    const map = new Map<string, Agent[]>([
      [CONTAINER, [buildAgent({ id: 's1' as AgentId, lastFinishedAt: NOW, lastViewedAt: NOW })]],
    ]);
    renderTree(map, { expanded: false });
    expect(screen.queryByTitle(/scout repl/)).toBeNull();
  });

  it('uses a flat Runs disclosure at the detail root', () => {
    const map = new Map<string, Agent[]>([
      [
        CONTAINER,
        [
          buildAgent({ id: 's1' as AgentId }),
          buildAgent({ id: 's2' as AgentId, status: 'running' }),
        ],
      ],
    ]);
    const { container } = renderTree(map, { variant: 'detail' });

    expect(screen.getByRole('button', { name: 'expand runs' }).textContent).toContain('Runs (1/2)');
    expect(container?.querySelector('.ml-3')).toBeNull();
    expect(container?.querySelector('.border-l')).toBeNull();
  });
});
