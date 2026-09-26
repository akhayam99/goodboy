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

  it('reads a type role as a size, so a text colour never drops it', () => {
    expect(cn('text-row', 'text-muted-foreground')).toBe('text-row text-muted-foreground');
    expect(cn('text-eyebrow', 'text-faint-foreground')).toBe('text-eyebrow text-faint-foreground');
  });

  it('lets a later role or size replace an earlier one', () => {
    expect(cn('text-secondary', 'text-label')).toBe('text-label');
    expect(cn('text-body', 'text-xs')).toBe('text-xs');
  });
});
