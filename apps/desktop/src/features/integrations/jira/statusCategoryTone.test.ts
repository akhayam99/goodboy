import { describe, expect, it } from 'vitest';
import { statusCategoryTone } from './statusCategoryTone';

describe('statusCategoryTone', () => {
  it('keeps an in-progress issue informational rather than an attention state', () => {
    expect(statusCategoryTone({ statusCategory: 'indeterminate' })).toBe('info');
  });

  it('tones the remaining categories by their meaning', () => {
    expect(statusCategoryTone({ statusCategory: 'new' })).toBe('neutral');
    expect(statusCategoryTone({ statusCategory: 'done' })).toBe('success');
    expect(statusCategoryTone({ statusCategory: '' })).toBe('neutral');
  });
});
