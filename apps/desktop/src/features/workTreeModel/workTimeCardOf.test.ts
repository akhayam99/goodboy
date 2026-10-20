// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { plainWorkTime, workTime, workEstimateOf } from './workTime';
import { workTimeCardOf } from './workTimeCardOf';

const ESTIMATE = workEstimateOf({
  estimate: {
    tier: 'role',
    size: null,
    sampleCount: 12,
    lowMs: 300_000,
    midMs: 420_000,
    highMs: 600_000,
    cost: null,
  },
  basis: 'Based on 12 similar steps.',
});

describe('workTimeCardOf', () => {
  it('shows a running step as rows, the basis as the footnote and no joined text', () => {
    const time = workTime({
      phase: 'running',
      activeMs: 120_000,
      hasStarted: true,
      estimate: ESTIMATE,
      unknownBasis: null,
    });

    const card = workTimeCardOf({ time: time!, cost: null, note: null });

    expect(card.facts.map((fact) => fact.label)).toEqual(['Running', 'Usually']);
    expect(card.footnote).toBe('Based on 12 similar steps. Waiting on you is not counted.');
    expect(JSON.stringify(card)).not.toContain(' · ');
  });

  it('adds the cost row and the longer than usual state', () => {
    const time = workTime({
      phase: 'running',
      activeMs: 900_000,
      hasStarted: true,
      estimate: ESTIMATE,
      unknownBasis: null,
    });

    const card = workTimeCardOf({ time: time!, cost: '$0.42', note: time!.note });

    expect(card.state).toEqual({ tone: 'warning', words: 'Longer than usual' });
    expect(card.facts.map((fact) => fact.label)).toEqual(['Running', 'Most finish within', 'Cost']);
  });

  it('carries only the footnote for a plain time with no rows', () => {
    const card = workTimeCardOf({
      time: plainWorkTime({ label: '4m', detail: 'Four minutes.', footnote: 'Estimated' }),
      cost: null,
      note: null,
    });

    expect(card.facts).toEqual([]);
    expect(card.footnote).toBe('Estimated');
  });
});
