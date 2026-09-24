import { describe, expect, it } from 'vitest';
import { cn } from '../cn';

describe('cn', () => {
  it('keeps an overlay beside the surface it stacks on', () => {
    expect(cn('bg-subtle', 'bg-selected')).toBe('bg-subtle bg-selected');
    expect(cn('bg-muted', 'hover:bg-hover')).toBe('bg-muted hover:bg-hover');
  });

  it('still lets a later surface replace an earlier one', () => {
    expect(cn('bg-muted', 'bg-subtle')).toBe('bg-subtle');
  });
});
