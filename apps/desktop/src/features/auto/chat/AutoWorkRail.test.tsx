// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { anAgent } from '@goodboy/types/testing';
import { aDelegation, aPlanRow, aView, FIXTURE_ROOT } from '../testing/autoViewFixtures';
import { AutoWorkRail } from './AutoWorkRail';
import { railRowsOf } from './railRowsOf';

afterEach(cleanup);

const WORKING = aView({
  phase: 'waiting',
  spentUsd: 0.27,
  reservedUsd: 4.5,
  delegations: [
    aDelegation({
      key: 'planner',
      role: 'planner',
      state: 'settled',
      outcome: 'completed',
      settledAt: 5,
    }),
    aDelegation({
      key: 'impl',
      role: 'implementer',
      state: 'running',
      batch: 'batch-2',
      model: 'sonnet',
      effort: 'medium',
    }),
    aDelegation({
      key: 'test',
      role: 'tester',
      state: 'accepted',
      batch: 'batch-2',
      model: 'sonnet',
      effort: 'medium',
    }),
  ],
});

const ROOT_ROUTING = { provider: 'anthropic', model: 'opus', effort: 'medium' } as const;

describe('railRowsOf', () => {
  it('lists Auto first, then one row per child with its own state', () => {
    const rows = railRowsOf({
      view: WORKING,
      agents: [anAgent({ id: FIXTURE_ROOT })],
      rootRouting: ROOT_ROUTING,
    });

    expect(rows.map((row) => [row.label, row.node, row.word])).toEqual([
      ['Auto', 'running', 'Waiting'],
      ['Planner', 'done', 'Done'],
      ['Implementer', 'running', 'Running'],
      ['Tester', 'queued', 'Queued'],
    ]);
  });

  it('shows a revised producer once, with the state of its latest delegation', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        aDelegation({ key: 'planner', role: 'planner', state: 'settled', outcome: 'completed' }),
        {
          ...aDelegation({
            key: 'planner-2',
            role: 'planner',
            state: 'running',
            reviseOf: 'artifact-plan',
            baseRevision: 1,
          }),
          childAgentId: aDelegation({ key: 'planner', role: 'planner', state: 'running' })
            .childAgentId,
        },
      ],
    });

    const rows = railRowsOf({ view, agents: [], rootRouting: ROOT_ROUTING });

    expect(rows.filter((row) => row.label === 'Planner')).toHaveLength(1);
    expect(rows[1]?.word).toBe('Running');
  });

  it('puts Needs your approval on Auto while a plan waits', () => {
    const view = aView({
      phase: 'waiting',
      artifacts: [aPlanRow()],
      delegations: [
        aDelegation({ key: 'planner', role: 'planner', state: 'settled', outcome: 'completed' }),
      ],
    });

    const [root] = railRowsOf({ view, agents: [], rootRouting: ROOT_ROUTING });

    expect(root).toMatchObject({ node: 'approval', word: 'Needs your approval', tone: 'warning' });
  });

  it('says Ready for an Auto that only answers and Done when the tree is done', () => {
    expect(railRowsOf({ view: aView(), agents: [], rootRouting: ROOT_ROUTING })[0]?.word).toBe(
      'Ready',
    );
    expect(
      railRowsOf({ view: aView({ phase: 'done' }), agents: [], rootRouting: ROOT_ROUTING })[0]
        ?.word,
    ).toBe('Done');
  });
});

type RailParams = {
  readonly isCollapsed?: boolean;
  readonly onOpen?: () => void;
  readonly onToggle?: () => void;
};

const renderRail = ({
  isCollapsed = false,
  onOpen = vi.fn(),
  onToggle = vi.fn(),
}: RailParams = {}) =>
  render(
    <AutoWorkRail
      rows={railRowsOf({ view: WORKING, agents: [], rootRouting: ROOT_ROUTING })}
      budget={WORKING.budget}
      selectedAgentId={FIXTURE_ROOT}
      isCollapsed={isCollapsed}
      onToggleCollapsed={onToggle}
      onOpen={onOpen}
    />,
  );

describe('AutoWorkRail', () => {
  it('draws every row expanded with no group row, one spine layer and the tree budget', () => {
    renderRail();

    const rail = screen.getByRole('complementary', { name: 'Work' });
    expect(within(rail).getByRole('heading', { name: /Work/ }).textContent).toContain('4');
    expect(within(rail).getAllByRole('listitem')).toHaveLength(4);
    expect(within(rail).queryByText(/subagents/i)).toBeNull();
    expect(
      rail.querySelectorAll('svg[aria-hidden] [data-testid="auto-rail-segment"]'),
    ).toHaveLength(3);
    const budget = within(rail).getByRole('region', { name: 'Tree budget' });
    expect(within(budget).getByText('Limit $10.00')).toBeDefined();
    expect(within(budget).getByText('Spent $0.27')).toBeDefined();
    expect(within(budget).getByText('Reserved $4.50')).toBeDefined();
    expect(within(budget).getByText('Left $5.23')).toBeDefined();
  });

  it('draws the spine in the tone of the ring it reaches, dashed for the queued one', () => {
    renderRail();

    const segments = [...document.querySelectorAll('[data-testid="auto-rail-segment"]')];

    expect(segments.map((segment) => segment.getAttribute('stroke'))).toEqual([
      'var(--color-success)',
      'var(--color-info)',
      'var(--color-border)',
    ]);
    expect(segments[2]?.getAttribute('stroke-dasharray')).toBe('3 3');
  });

  it('opens the agent of a row', () => {
    const onOpen = vi.fn();
    renderRail({ onOpen });

    fireEvent.click(screen.getByRole('button', { name: 'Show Implementer' }));

    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ label: 'Implementer' }));
  });

  it('collapses to a strip of rings and drops the budget', () => {
    const onToggle = vi.fn();
    renderRail({ isCollapsed: true, onToggle });

    const rail = screen.getByRole('complementary', { name: 'Work' });
    expect(rail.getAttribute('data-mode')).toBe('strip');
    expect(within(rail).getAllByRole('button', { name: /^Show / })).toHaveLength(4);
    expect(within(rail).queryByRole('region', { name: 'Tree budget' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand the work list' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
