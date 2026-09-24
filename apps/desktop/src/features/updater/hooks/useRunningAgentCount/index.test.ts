import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { countRunningAgents } from './index';

const at = '2026-09-23T10:00:00Z' as IsoDateTime;
const run = 'run-1' as ProviderRunId;

describe('countRunningAgents', () => {
  it('counts starting, running and blocked turns only', () => {
    expect(
      countRunningAgents({
        turnStates: {
          a: { kind: 'running', runId: run, startedAt: at },
          b: { kind: 'starting', startedAt: at },
          c: { kind: 'blocked', runId: run, blockedAt: at },
          d: { kind: 'idle', lastActivityAt: at },
          e: { kind: 'ended', endedAt: at },
        },
      }),
    ).toBe(3);
  });

  it('is zero when nothing runs', () => {
    expect(countRunningAgents({ turnStates: {} })).toBe(0);
  });
});
