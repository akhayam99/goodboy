import { describe, expect, it } from 'vitest';
import { sessionCardShell } from './sessionCardShell';

describe('sessionCardShell', () => {
  it('carries the stage tone on the left rail only, never around the box', () => {
    const running = sessionCardShell({ stage: 'running' });
    const attention = sessionCardShell({ stage: 'attention' });
    expect(running).toContain('border-l-2');
    expect(running).toContain('border-border-soft');
    expect(running).toContain('border-l-info/40');
    expect(running).toContain('spin-rail spin-border-info');
    expect(running).not.toMatch(/(^| )border-info/);
    expect(running).not.toMatch(/(^| )spin-border( |$)/);
    expect(attention).toContain('border-border-soft');
    expect(attention).toContain('border-l-warning');
    expect(attention).not.toMatch(/(^| )border-warning/);
    expect(attention).not.toContain('spin-rail');
    expect(sessionCardShell({ stage: 'done' })).toContain('border-border-soft');
    expect(sessionCardShell({ stage: 'done' })).not.toContain('spin-rail');
  });

  it('tones the needs-you rail by the reason the session waits', () => {
    expect(sessionCardShell({ stage: 'attention', attention: 'agent-error' })).toContain(
      'border-l-danger',
    );
    expect(sessionCardShell({ stage: 'attention', attention: 'open-question' })).toContain(
      'border-l-warning',
    );
    expect(sessionCardShell({ stage: 'attention', attention: 'unread-reply' })).toContain(
      'border-l-primary',
    );
  });

  it('rests on the elevated surface without a shadow', () => {
    const classes = sessionCardShell({ stage: 'building' });
    expect(classes).toContain('bg-elevated');
    expect(classes).toContain('text-foreground');
    expect(classes).not.toContain('shadow-sm');
    expect(classes).not.toContain('bg-muted/40');
    expect(classes).not.toContain('text-foreground/70');
  });

  it('lets selection win over the stage tint', () => {
    const classes = sessionCardShell({ stage: 'running', selected: true });
    expect(classes).toContain('border-primary');
    expect(classes).not.toContain('border-l-info');
    expect(classes).not.toContain('spin-rail');
  });

  it('lifts the active card and neutralises its border', () => {
    const classes = sessionCardShell({ stage: 'running', active: true });
    expect(classes).toContain('bg-elevated');
    expect(classes).toContain('shadow-sm');
    expect(classes).toContain('border-border');
    expect(classes).not.toContain('border-l-info');
  });

  it('dims on request', () => {
    expect(sessionCardShell({ stage: 'done', dimmed: true })).toContain('opacity-50');
    expect(sessionCardShell({ stage: 'done' })).not.toContain('opacity-50');
  });
});
