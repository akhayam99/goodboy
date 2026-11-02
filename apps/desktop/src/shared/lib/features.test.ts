import { describe, expect, it } from 'vitest';
import { WORKSPACE_FEATURES } from './features';

describe('WORKSPACE_FEATURES', () => {
  it('has no skills flag, the feature is deleted', () => {
    expect(Object.keys(WORKSPACE_FEATURES)).not.toContain('skills');
  });
});
