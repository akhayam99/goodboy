import { describe, expect, it } from 'vitest';
import { isSessionGroupCollapsed } from './isSessionGroupCollapsed';
import { toggleSessionGroup } from './toggleSessionGroup';
import type { SetFn } from './types';

describe('isSessionGroupCollapsed', () => {
  it.each(['done', 'merged', 'closed'])('collapses %s by default', (key) => {
    expect(isSessionGroupCollapsed({ key, overrides: {} })).toBe(true);
  });

  it.each(['attention', 'running', 'none'])('keeps %s open by default', (key) => {
    expect(isSessionGroupCollapsed({ key, overrides: {} })).toBe(false);
  });

  it('lets an override win over the default in both directions', () => {
    expect(isSessionGroupCollapsed({ key: 'done', overrides: { done: true } })).toBe(false);
    expect(isSessionGroupCollapsed({ key: 'running', overrides: { running: false } })).toBe(true);
  });
});

describe('toggleSessionGroup', () => {
  it('flips a default-collapsed group open, then closed again', () => {
    const holder: { sessionGroupExpanded: Record<string, boolean> } = { sessionGroupExpanded: {} };
    const set = ((update: unknown) => {
      const partial = typeof update === 'function' ? update(holder) : update;
      Object.assign(holder, partial);
    }) as unknown as SetFn;
    const toggle = toggleSessionGroup(set);

    toggle({ key: 'done' });
    expect(isSessionGroupCollapsed({ key: 'done', overrides: holder.sessionGroupExpanded })).toBe(
      false,
    );
    toggle({ key: 'done' });
    expect(isSessionGroupCollapsed({ key: 'done', overrides: holder.sessionGroupExpanded })).toBe(
      true,
    );
  });
});
