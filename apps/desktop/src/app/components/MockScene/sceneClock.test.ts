import { afterEach, describe, expect, it, vi } from 'vitest';

const LOADED_AT = Date.parse('2027-01-10T08:00:00.000Z');
const ANCHOR = '2026-08-25T18:00:00.000Z';

const loadSceneClock = async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(LOADED_AT);
  const { sceneClock } = await import('./sceneClock');
  return sceneClock;
};

describe('sceneClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps the anchor to the moment the module loaded', async () => {
    const sceneClock = await loadSceneClock();
    const clock = sceneClock({ anchor: ANCHOR });

    expect(clock.ms({ at: ANCHOR })).toBe(LOADED_AT);
    expect(clock.iso({ at: ANCHOR })).toBe('2027-01-10T08:00:00.000Z');
  });

  it('keeps the gaps between seeded instants', async () => {
    const sceneClock = await loadSceneClock();
    const clock = sceneClock({ anchor: ANCHOR });

    expect(clock.ms({ at: '2026-08-25T17:04:30.000Z' })).toBe(LOADED_AT - 55.5 * 60_000);
    expect(clock.iso({ at: '2026-08-24T18:00:00.000Z' })).toBe('2027-01-09T08:00:00.000Z');
  });

  it('shares one load instant across anchors', async () => {
    const sceneClock = await loadSceneClock();
    vi.setSystemTime(LOADED_AT + 3_600_000);
    const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

    expect(clock.ms({ at: '2026-09-16T11:20:00.000Z' })).toBe(LOADED_AT);
  });
});
