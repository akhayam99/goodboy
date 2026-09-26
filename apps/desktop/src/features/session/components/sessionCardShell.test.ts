import { describe, expect, it } from 'vitest';
import { sessionCardShell, sessionTone } from './sessionCardShell';

describe('sessionTone', () => {
  it('gives every stage a tone, not only running and attention', () => {
    expect(sessionTone({ stage: 'building' }).tone).toBe('neutral');
    expect(sessionTone({ stage: 'running' }).tone).toBe('info');
    expect(sessionTone({ stage: 'review' }).tone).toBe('success');
    expect(sessionTone({ stage: 'done' }).tone).toBe('merged');
  });

  it('breathes only while running', () => {
    expect(sessionTone({ stage: 'running' }).isBreathing).toBe(true);
    expect(sessionTone({ stage: 'building' }).isBreathing).toBe(false);
    expect(sessionTone({ stage: 'review' }).isBreathing).toBe(false);
    expect(sessionTone({ stage: 'done' }).isBreathing).toBe(false);
  });

  it('tones the needs-you bar by the reason the session waits', () => {
    expect(sessionTone({ stage: 'attention', attention: 'agent-error' }).tone).toBe('danger');
    expect(sessionTone({ stage: 'attention', attention: 'open-question' }).tone).toBe('warning');
    expect(sessionTone({ stage: 'attention', attention: 'unread-reply' }).tone).toBe('primary');
  });

  it('falls back to the stage tone when attention carries no reason', () => {
    expect(sessionTone({ stage: 'attention' }).tone).toBe('warning');
  });
});

describe('sessionCardShell', () => {
  it('rests on one uniform hairline, never a colored side border', () => {
    const classes = sessionCardShell({});
    expect(classes).toContain('border-border-soft');
    expect(classes).toContain('hover:border-border');
    expect(classes).not.toContain('border-l-2');
    expect(classes).not.toMatch(/border-l-(info|warning|danger|success|primary|merged)/);
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
