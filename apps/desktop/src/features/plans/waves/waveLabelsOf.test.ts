// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type ArtifactId,
  type ImplementationCluster,
  type IsoDateTime,
  type PlanWithCount,
  type SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { waveLabelsOf } from './waveLabelsOf';

const NOW = brandId<IsoDateTime>({ value: '2026-10-28T09:00:00.000Z' });
const PLAN_ID = brandId<ArtifactId>({ value: 'plan-cascadia' });
const SESSION_ID = brandId<SessionId>({ value: 'session-cascadia' });
const PARENT_ID = brandId<AgentId>({ value: 'impl-cascadia' });

const planOf = (clusters: ReadonlyArray<ImplementationCluster>): PlanWithCount => ({
  id: PLAN_ID,
  sessionId: SESSION_ID,
  agentId: brandId<AgentId>({ value: 'planner-cascadia' }),
  title: 'goal',
  bodyMd: '',
  status: 'consumed',
  consumptionCount: 1,
  lastConsumer: { agentId: PARENT_ID, name: null },
  createdAt: NOW,
  updatedAt: NOW,
  clusters,
});

const children = (count: number): ReadonlyArray<Agent> =>
  Array.from({ length: count }, (_, index) =>
    anAgent({
      id: brandId<AgentId>({ value: `part-${index}` }),
      sessionId: SESSION_ID,
      parentAgentId: PARENT_ID,
      ordinal: index,
      kind: 'implementer',
    }),
  );

describe('waveLabelsOf', () => {
  it('labels each subagent with the wave its part runs in', () => {
    const labels = waveLabelsOf({
      plans: [
        planOf([
          { title: 'Routes', instructions: 'x', id: 'routes', touches: ['src/routes.ts'] },
          { title: 'Home', instructions: 'x', after: ['routes'], touches: ['src/home'] },
          { title: 'Chat', instructions: 'x', after: ['routes'], touches: ['src/chat'] },
        ]),
      ],
      agents: children(3),
    });

    expect([...labels.entries()]).toEqual([
      ['part-0', 'Runs first'],
      ['part-1', 'Then, in parallel'],
      ['part-2', 'Then, in parallel'],
    ]);
  });

  it('adds no label to a plain chain of parts', () => {
    const labels = waveLabelsOf({
      plans: [
        planOf([
          { title: 'A', instructions: 'x', id: 'a', touches: ['src/a'] },
          { title: 'B', instructions: 'x', after: ['a'], touches: ['src/b'] },
        ]),
      ],
      agents: children(2),
    });

    expect(labels.size).toBe(0);
  });

  it('adds no label to a plan nobody ran', () => {
    const labels = waveLabelsOf({
      plans: [
        {
          ...planOf([
            { title: 'A', instructions: 'x', touches: ['src/a'] },
            { title: 'B', instructions: 'x', touches: ['src/b'] },
          ]),
          status: 'active',
          consumptionCount: 0,
          lastConsumer: null,
        },
      ],
      agents: children(2),
    });

    expect(labels.size).toBe(0);
  });

  it('adds no label when the subagents do not match the parts', () => {
    const labels = waveLabelsOf({
      plans: [
        planOf([
          { title: 'A', instructions: 'x', touches: ['src/a'] },
          { title: 'B', instructions: 'x', touches: ['src/b'] },
        ]),
      ],
      agents: children(3),
    });

    expect(labels.size).toBe(0);
  });
});
