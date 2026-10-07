import { describe, expect, it } from 'vitest';
import { followDedupeKey } from './followToast';

describe('followToast', () => {
  it('prefixes the toast dedupe key with follow', () => {
    expect(followDedupeKey({ startKey: 'run-harborline' })).toBe('follow:run-harborline');
  });
});
