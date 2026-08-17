import { describe, expect, it } from 'vitest';
import { pluralize } from './pluralize';

describe('pluralize', () => {
  it('keeps the singular for a count of one', () => {
    expect(pluralize(1, 'agent')).toBe('1 agent');
  });

  it('pluralizes zero', () => {
    expect(pluralize(0, 'agent')).toBe('0 agents');
  });

  it('pluralizes counts above one', () => {
    expect(pluralize(3, 'agent')).toBe('3 agents');
  });
});
