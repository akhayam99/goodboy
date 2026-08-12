import { describe, expect, it } from 'vitest';
import { sessionCardShell } from './sessionCardShell';

describe('sessionCardShell', () => {
  it('tints the border by stage', () => {
    expect(sessionCardShell({ stage: 'running' })).toContain('border-info/50');
    expect(sessionCardShell({ stage: 'attention' })).toContain('border-warning/50');
    expect(sessionCardShell({ stage: 'done' })).toContain('border-transparent');
  });

  it('lets selection win over the stage tint', () => {
    const classes = sessionCardShell({ stage: 'running', selected: true });
    expect(classes).toContain('border-primary');
    expect(classes).not.toContain('border-info/50');
  });

  it('lifts the active card and neutralises its border', () => {
    const classes = sessionCardShell({ stage: 'running', active: true });
    expect(classes).toContain('bg-elevated');
    expect(classes).toContain('shadow-sm');
    expect(classes).toContain('border-border');
    expect(classes).not.toContain('border-info/50');
  });

  it('dims on request', () => {
    expect(sessionCardShell({ stage: 'done', dimmed: true })).toContain('opacity-50');
    expect(sessionCardShell({ stage: 'done' })).not.toContain('opacity-50');
  });
});
