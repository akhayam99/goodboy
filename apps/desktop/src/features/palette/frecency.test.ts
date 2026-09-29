// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  EMPTY_FRECENCY,
  FRECENCY_HALF_LIFE_MS,
  FRECENCY_MAX_KEYS,
  FRECENCY_MAX_USES,
  frecencyScore,
  parseFrecency,
  recentKeys,
  recordUse,
} from './frecency';

const NOW = Date.parse('2026-09-28T09:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('frecency', () => {
  it('counts a use made now as one', () => {
    const state = recordUse({ state: EMPTY_FRECENCY, key: 'session:a', now: NOW });

    expect(frecencyScore({ state, key: 'session:a', now: NOW })).toBeCloseTo(1);
  });

  it('halves a use after the seven day half life', () => {
    const state = recordUse({ state: EMPTY_FRECENCY, key: 'session:a', now: NOW });

    expect(
      frecencyScore({ state, key: 'session:a', now: NOW + FRECENCY_HALF_LIFE_MS }),
    ).toBeCloseTo(0.5);
  });

  it('ranks three uses last month below one use today plus one yesterday', () => {
    let state = EMPTY_FRECENCY;
    for (const offset of [30, 31, 32]) {
      state = recordUse({ state, key: 'old', now: NOW - offset * DAY });
    }
    state = recordUse({ state, key: 'fresh', now: NOW - DAY });
    state = recordUse({ state, key: 'fresh', now: NOW });

    expect(recentKeys({ state, now: NOW, limit: 2 })).toEqual(['fresh', 'old']);
  });

  it('keeps only the latest uses of one key', () => {
    let state = EMPTY_FRECENCY;
    for (let index = 0; index < FRECENCY_MAX_USES + 5; index += 1) {
      state = recordUse({ state, key: 'verb:archive', now: NOW + index });
    }

    expect(state['verb:archive']).toHaveLength(FRECENCY_MAX_USES);
    expect(state['verb:archive']?.[0]).toBe(NOW + FRECENCY_MAX_USES + 4);
  });

  it('drops the weakest key past the cap and keeps the one just used', () => {
    let state = EMPTY_FRECENCY;
    for (let index = 0; index < FRECENCY_MAX_KEYS; index += 1) {
      state = recordUse({ state, key: `k${index}`, now: NOW - index * DAY });
    }
    state = recordUse({ state, key: 'newest', now: NOW + DAY });

    expect(Object.keys(state)).toHaveLength(FRECENCY_MAX_KEYS);
    expect(state.newest).toBeDefined();
    expect(state[`k${FRECENCY_MAX_KEYS - 1}`]).toBeUndefined();
  });

  it('reads back what it wrote and ignores anything malformed', () => {
    const state = recordUse({ state: EMPTY_FRECENCY, key: 'session:a', now: NOW });

    expect(parseFrecency(JSON.stringify(state))).toEqual(state);
    expect(parseFrecency('not json')).toEqual(EMPTY_FRECENCY);
    expect(parseFrecency('[1,2]')).toEqual(EMPTY_FRECENCY);
    expect(parseFrecency(JSON.stringify({ good: [NOW], bad: ['x'] }))).toEqual({ good: [NOW] });
  });
});
