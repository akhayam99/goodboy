import { describe, expect, it } from 'vitest';
import { needsYouText } from './needsYouText';

describe('needsYouText', () => {
  it('names the sessions the door and the top bar count', () => {
    expect(needsYouText({ count: 1, unit: 'sessions' })).toBe('1 session needs you');
    expect(needsYouText({ count: 2, unit: 'sessions' })).toBe('2 sessions need you');
  });

  it('names the items the Overview and the Runs group count', () => {
    expect(needsYouText({ count: 1, unit: 'items' })).toBe('1 item needs you');
    expect(needsYouText({ count: 4, unit: 'items' })).toBe('4 items need you');
  });
});
