// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sessionCardShell } from './sessionCardShell';

describe('sessionCardShell', () => {
  it('rests on one uniform hairline, never a colored side border', () => {
    const classes = sessionCardShell({});
    expect(classes).toContain('border-border-soft');
    expect(classes).toContain('hover:border-border');
    expect(classes).not.toContain('border-l-2');
    expect(classes).not.toMatch(/border-l-(info|warning|danger|success|primary|merged)/);
  });

  it('washes the whole card on hover with the shared wash, a selected card keeps its tint', () => {
    expect(sessionCardShell({})).toContain('hover:bg-hover');
    expect(sessionCardShell({ selected: true })).not.toContain('hover:bg-hover');
  });

  it('positions itself so the tone bar can sit inside it', () => {
    expect(sessionCardShell({})).toContain('relative');
  });

  it('rests on the elevated surface without a shadow', () => {
    const classes = sessionCardShell({});
    expect(classes).toContain('bg-elevated');
    expect(classes).toContain('text-foreground');
    expect(classes).not.toContain('shadow-sm');
  });

  it('marks selection with a primary border, never a ring', () => {
    const classes = sessionCardShell({ selected: true });
    expect(classes).toContain('border-primary');
    expect(classes).not.toContain('ring-1');
  });

  it('lifts the active card and neutralises its border', () => {
    const classes = sessionCardShell({ active: true });
    expect(classes).toContain('bg-elevated');
    expect(classes).toContain('shadow-sm');
    expect(classes).toContain('border-border');
  });

  it('dims on request', () => {
    expect(sessionCardShell({ dimmed: true })).toContain('opacity-50');
    expect(sessionCardShell({})).not.toContain('opacity-50');
  });
});
