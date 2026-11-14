import { describe, expect, it } from 'vitest';
import { leadLayoutOf } from './leadLayoutOf';

describe('leadLayoutOf', () => {
  it('shows chat, tree and the right slot from 1180 up', () => {
    expect(leadLayoutOf({ width: 1180 })).toBe('wide');
    expect(leadLayoutOf({ width: 1600 })).toBe('wide');
  });

  it('covers the tree with the record from 860 to 1180', () => {
    expect(leadLayoutOf({ width: 1179 })).toBe('medium');
    expect(leadLayoutOf({ width: 860 })).toBe('medium');
  });

  it('keeps the chat alone under 860', () => {
    expect(leadLayoutOf({ width: 859 })).toBe('narrow');
  });

  it('reads an unmeasured pane as wide', () => {
    expect(leadLayoutOf({ width: null })).toBe('wide');
  });
});
