// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fixLabel } from './reviewLaunchCopy';

describe('the Fix verb', () => {
  it.each([1, 2, 9])('reads Fix %i in the launch title', (count) => {
    expect(fixLabel({ count })).toBe(`Fix ${count}`);
  });
});
