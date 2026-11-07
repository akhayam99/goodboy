// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { stateBodyHasMore } from './stateBodyHasMore';

describe('stateBodyHasMore', () => {
  it('is false when the State line already says all of it', () => {
    expect(stateBodyHasMore({ body: '- Backfill is written and stays read only.' })).toBe(false);
    expect(stateBodyHasMore({ body: 'The retry banner ships behind a flag' })).toBe(false);
    expect(stateBodyHasMore({ body: '' })).toBe(false);
  });

  it('is true when more lines follow the first sentence', () => {
    expect(
      stateBodyHasMore({ body: '- Dedupe check is live\n- Backfill is written\n- 42 tests pass' }),
    ).toBe(true);
  });

  it('is true when one line carries a second sentence', () => {
    expect(stateBodyHasMore({ body: 'Dedupe check is live. Backfill is written.' })).toBe(true);
  });
});
