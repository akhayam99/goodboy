import { describe, expect, it } from 'vitest';
import { turnStats } from './turnStats';

describe('turnStats', () => {
  it('reads the median and p90 off the histogram', () => {
    const stats = turnStats({
      buckets: [
        { turnCount: 1, agentCount: 5 },
        { turnCount: 4, agentCount: 4 },
        { turnCount: 20, agentCount: 1 },
      ],
    });

    expect(stats?.agents).toBe(10);
    expect(stats?.median).toBe(1);
    expect(stats?.p90).toBe(4);
    expect(stats?.maxAgents).toBe(5);
  });

  it('returns nothing when no agent recorded a turn', () => {
    expect(turnStats({ buckets: [] })).toBeNull();
  });
});
