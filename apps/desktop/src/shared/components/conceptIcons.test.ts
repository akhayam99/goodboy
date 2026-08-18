import { describe, expect, it } from 'vitest';
import { CONCEPT_TONE } from './conceptIcons';

describe('CONCEPT_TONE', () => {
  it('uses the draft tone for plans', () => {
    expect(CONCEPT_TONE.plans).toBe('draft');
  });
});
