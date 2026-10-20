// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import { railRowCardOf } from './railRowCardOf';
import type { RailRow } from './railRowsOf';

const ROW: RailRow = {
  id: 'impl',
  agentId: brandId({ value: 'agent-impl' }),
  kind: 'child',
  depth: 1,
  role: 'implementer',
  label: 'Implementer',
  task: 'Build the credit retry keys',
  node: 'running',
  word: 'Running',
  tone: 'info',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'high',
  isLive: true,
};

describe('railRowCardOf', () => {
  it('titles the card with the row and gives the state, the task and the route as rows', () => {
    const card = railRowCardOf({ row: ROW });

    expect(card.title).toBe('Implementer');
    expect(card.state).toEqual({ tone: 'info', words: 'Running' });
    expect(card.facts.map((fact) => [fact.label, fact.value])).toEqual([
      ['Task', 'Build the credit retry keys'],
      ['Provider', 'Claude'],
      ['Model', 'Sonnet 5'],
      ['Effort', 'High'],
    ]);
  });

  it('has no task row without a task and no route rows without a model', () => {
    const card = railRowCardOf({ row: { ...ROW, task: null, provider: null, model: null } });

    expect(card.facts).toEqual([]);
  });

  it('carries no joined middot text', () => {
    const text = JSON.stringify(railRowCardOf({ row: ROW }));

    expect(text).not.toContain(' · ');
  });
});
