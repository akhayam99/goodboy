import { describe, expect, it } from 'vitest';
import { recentBannersOf } from './recentBannersOf';

describe('the banners sent in the last 30 seconds', () => {
  it('keeps the recent ones and drops the older ones', () => {
    expect(recentBannersOf({ sentAt: [1_000, 20_000, 31_500], nowMs: 31_500 })).toEqual([
      20_000, 31_500,
    ]);
  });
});
