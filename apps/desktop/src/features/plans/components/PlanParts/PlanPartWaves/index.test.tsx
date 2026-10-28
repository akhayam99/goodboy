// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type ImplementationCluster,
  type IsoDateTime,
  type PlanWithCount,
  type SessionId,
} from '@goodboy/types';
import { planPartOrder } from '../../../waves/planPartOrder';
import { planPartRows } from '../planPartRows';
import { PlanPartWaves } from './index';

const NOW = brandId<IsoDateTime>({ value: '2026-10-28T09:00:00.000Z' });

const clusters: ReadonlyArray<ImplementationCluster> = [
  {
    title: 'Routes',
    instructions: 'x',
    id: 'routes',
    touches: ['apps/web/src/routes.ts', 'next.config.ts'],
  },
  {
    title: 'Home',
    instructions: 'x',
    id: 'home',
    after: ['routes'],
    touches: [
      'apps/web/src/home',
      'apps/web/src/home/Header.tsx',
      'apps/web/src/home/Cta.tsx',
      'docs/home.md',
    ],
  },
  {
    title: 'Chat',
    instructions: 'x',
    id: 'chat',
    after: ['routes'],
    touches: ['apps/web/src/chat'],
  },
];

const plan: PlanWithCount = {
  id: brandId<ArtifactId>({ value: 'plan-northwind' }),
  sessionId: brandId<SessionId>({ value: 'session-northwind' }),
  agentId: brandId<AgentId>({ value: 'planner-northwind' }),
  title: 'goal',
  bodyMd: '',
  status: 'active',
  consumptionCount: 0,
  createdAt: NOW,
  updatedAt: NOW,
  clusters,
};

const renderWaves = () => {
  const rows = planPartRows({ plan, agents: [], askingAgentIds: new Set() });
  render(
    <PlanPartWaves
      order={planPartOrder({ rows })}
      renderRow={({ row }) => <span>{`row ${row.title}`}</span>}
    />,
  );
};

afterEach(cleanup);

describe('PlanPartWaves', () => {
  it('groups the parts into waves with a label each', () => {
    renderWaves();

    const waves = screen.getAllByTestId('plan-part-wave');
    expect(waves.map((wave) => wave.getAttribute('aria-label'))).toEqual([
      'Runs first',
      'Then, in parallel',
    ]);
    within(waves[0]!).getByText('row Routes');
    within(waves[1]!).getByText('row Home');
    within(waves[1]!).getByText('row Chat');
  });

  it('shows each part as its own block that lists what it touches', () => {
    renderWaves();

    const blocks = screen.getAllByTestId('plan-part-block');
    expect(blocks).toHaveLength(3);
    const home = blocks.find((block) => block.getAttribute('data-plan-part-block') === '2')!;
    within(home).getByText('apps/web/src/home');
    within(home).getByText('+1 more');
    const routes = blocks.find((block) => block.getAttribute('data-plan-part-block') === '1')!;
    within(routes).getByText('next.config.ts');
  });

  it('names a shared file and the order it forces', () => {
    const rows = planPartRows({
      plan: {
        ...plan,
        clusters: [
          { title: 'A', instructions: 'x', touches: ['next.config.ts'] },
          { title: 'B', instructions: 'x', touches: ['next.config.ts'] },
        ],
      },
      agents: [],
      askingAgentIds: new Set(),
    });
    render(
      <PlanPartWaves
        order={planPartOrder({ rows })}
        renderRow={({ row }) => <span>{row.title}</span>}
      />,
    );

    const notes = screen.getByTestId('plan-part-order');
    expect(notes.textContent).toBe(
      'next.config.ts is shared by parts 1 and 2, so part 1 goes first.',
    );
  });
});
