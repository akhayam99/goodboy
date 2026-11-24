import { describe, expect, it } from 'vitest';
import { providerLoad } from './providerLoad';

const NOW = Date.parse('2026-11-24T10:00:00.000Z');
const MINUTE = 60_000;
const SINCE = NOW - 60 * MINUTE;

describe('providerLoad', () => {
  it('counts agents, not turns, per provider', () => {
    expect(
      providerLoad({
        finished: [
          { provider: 'cursor', agentId: 'scout-1', lastEndedAtMs: NOW - 5 * MINUTE },
          { provider: 'cursor', agentId: 'scout-1', lastEndedAtMs: NOW - 2 * MINUTE },
          { provider: 'cursor', agentId: 'reviewer-1', lastEndedAtMs: NOW - 9 * MINUTE },
          { provider: 'codex', agentId: 'implementer-1', lastEndedAtMs: NOW - MINUTE },
        ],
        running: [],
        sinceMs: SINCE,
      }),
    ).toEqual({ cursor: 2, codex: 1 });
  });

  it('counts running agents that have not closed a turn yet', () => {
    expect(
      providerLoad({
        finished: [],
        running: [
          { provider: 'copilot', agentId: 'scout-2' },
          { provider: 'copilot', agentId: 'scout-3' },
        ],
        sinceMs: SINCE,
      }),
    ).toEqual({ copilot: 2 });
  });

  it('counts a running agent once when it also closed a turn in the window', () => {
    expect(
      providerLoad({
        finished: [{ provider: 'cursor', agentId: 'scout-1', lastEndedAtMs: NOW - MINUTE }],
        running: [{ provider: 'cursor', agentId: 'scout-1' }],
        sinceMs: SINCE,
      }),
    ).toEqual({ cursor: 1 });
  });

  it('leaves out agents whose last turn ended before the window', () => {
    expect(
      providerLoad({
        finished: [{ provider: 'cursor', agentId: 'scout-1', lastEndedAtMs: SINCE - 1 }],
        running: [],
        sinceMs: SINCE,
      }),
    ).toEqual({});
  });

  it('skips a provider name that is not a provider id', () => {
    expect(
      providerLoad({
        finished: [{ provider: 'openai', agentId: 'scout-1', lastEndedAtMs: NOW }],
        running: [],
        sinceMs: SINCE,
      }),
    ).toEqual({});
  });
});
