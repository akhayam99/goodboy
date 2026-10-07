import { describe, expect, it } from 'vitest';
import { FOLLOW_LABEL, FOLLOW_RUN_LABEL, followDedupeKey } from './followToast';

describe('followToast', () => {
  it('names the two Follow labels', () => {
    expect(FOLLOW_LABEL).toBe('Follow');
    expect(FOLLOW_RUN_LABEL).toBe('Follow the run');
  });

  it('prefixes the toast dedupe key with follow', () => {
    expect(followDedupeKey({ startKey: 'run-harborline' })).toBe('follow:run-harborline');
  });
});
