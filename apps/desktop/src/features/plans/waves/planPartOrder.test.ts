// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type ImplementationCluster,
  type IsoDateTime,
  type PlanWithCount,
  type SessionId,
} from '@goodboy/types';
import { planPartRows } from '../components/PlanParts/planPartRows';
import { planPartOrder } from './planPartOrder';
import { waveLabel } from './waveLabel';

const NOW = brandId<IsoDateTime>({ value: '2026-10-28T09:00:00.000Z' });

type PartParams = Readonly<{
  title: string;
  extra?: Partial<ImplementationCluster>;
}>;

const part = ({ title, extra = {} }: PartParams): ImplementationCluster => ({
  title,
  instructions: `do ${title}`,
  ...extra,
});

const orderOf = (clusters: ReadonlyArray<ImplementationCluster>) => {
  const plan: PlanWithCount = {
    id: brandId<ArtifactId>({ value: 'plan-harborline' }),
    sessionId: brandId<SessionId>({ value: 'session-harborline' }),
    agentId: brandId<AgentId>({ value: 'planner-harborline' }),
    title: 'goal',
    bodyMd: '',
    status: 'active',
    consumptionCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    clusters,
  };
  return planPartOrder({ rows: planPartRows({ plan, agents: [], askingAgentIds: new Set() }) });
};

describe('waveLabel', () => {
  it('names the first wave, the next ones and parallel waves', () => {
    expect(waveLabel({ index: 0, size: 1 })).toBe('Runs first');
    expect(waveLabel({ index: 0, size: 2 })).toBe('Runs first, in parallel');
    expect(waveLabel({ index: 1, size: 1 })).toBe('Then');
    expect(waveLabel({ index: 2, size: 3 })).toBe('Then, in parallel');
  });
});

describe('planPartOrder', () => {
  it('groups a shared first part and the two parts that come after it', () => {
    const order = orderOf([
      part({ title: 'Routes', extra: { id: 'routes', touches: ['src/routes.ts'] } }),
      part({ title: 'Home', extra: { id: 'home', after: ['routes'], touches: ['src/home'] } }),
      part({ title: 'Chat', extra: { id: 'chat', after: ['routes'], touches: ['src/chat'] } }),
    ]);

    expect(order.hasGroups).toBe(true);
    expect(order.waves.map((wave) => [wave.label, wave.rows.map((row) => row.title)])).toEqual([
      ['Runs first', ['Routes']],
      ['Then, in parallel', ['Home', 'Chat']],
    ]);
    expect(order.shared).toEqual([]);
    expect(order.notes).toEqual([]);
  });

  it('names a file two parts share and the order it forces', () => {
    const order = orderOf([
      part({ title: 'A', extra: { touches: ['next.config.ts', 'src/a'] } }),
      part({ title: 'B', extra: { touches: ['next.config.ts', 'src/b'] } }),
    ]);

    expect(order.shared).toEqual([
      { path: 'next.config.ts', rest: 'is shared by parts 1 and 2, so part 1 goes first.' },
    ]);
    expect(order.waves.map((wave) => wave.label)).toEqual(['Runs first', 'Then']);
  });

  it('names a file three parts share', () => {
    const order = orderOf([
      part({ title: 'A', extra: { touches: ['src/routes.ts'] } }),
      part({ title: 'B', extra: { touches: ['src/routes.ts'] } }),
      part({ title: 'C', extra: { touches: ['src/routes.ts'] } }),
    ]);

    expect(order.shared).toEqual([
      { path: 'src/routes.ts', rest: 'is shared by parts 1, 2, and 3, so they go in that order.' },
    ]);
  });

  it('says a part with no files runs on its own', () => {
    const order = orderOf([
      part({ title: 'A', extra: { touches: ['src/a'] } }),
      part({ title: 'B' }),
    ]);

    expect(order.notes).toEqual(['Part 2 lists no files, so it runs on its own.']);
    expect(order.hasGroups).toBe(true);
  });

  it('says why the planner order was dropped', () => {
    const order = orderOf([
      part({ title: 'A', extra: { id: 'a', after: ['b'], touches: ['src/a'] } }),
      part({ title: 'B', extra: { id: 'b', after: ['a'], touches: ['src/b'] } }),
    ]);

    expect(order.notes).toEqual([
      "The planner's order couldn't be used (the parts wait for each other), so the parts are ordered by the files they touch.",
    ]);
    expect(order.waves.map((wave) => wave.rows.length)).toEqual([2]);
  });

  it('keeps a plain chain on separate files as a flat list', () => {
    const order = orderOf([
      part({ title: 'A', extra: { id: 'a', touches: ['src/a'] } }),
      part({ title: 'B', extra: { id: 'b', after: ['a'], touches: ['src/b'] } }),
    ]);

    expect(order.hasGroups).toBe(false);
  });
});
