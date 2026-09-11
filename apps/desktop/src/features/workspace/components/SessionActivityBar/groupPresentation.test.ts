import { describe, expect, it } from 'vitest';
import { sessionGroupPresentation } from './groupPresentation';

describe('sessionGroupPresentation', () => {
  it('labels the merge queue group instead of leaking the raw key', () => {
    expect(sessionGroupPresentation({ key: 'queued', groupMode: 'pr' })?.label).toBe('queued');
  });

  it('keeps a merged group apart from a closed one', () => {
    const merged = sessionGroupPresentation({ key: 'merged', groupMode: 'pr' });
    const closed = sessionGroupPresentation({ key: 'closed', groupMode: 'pr' });

    expect(merged?.tone).not.toBe(closed?.tone);
    expect(merged?.reason).not.toBe(closed?.reason);
  });

  it('gives every stage group a reason a tooltip can show', () => {
    const running = sessionGroupPresentation({ key: 'running', groupMode: 'stage' });

    expect(running?.label).toBe('running');
    expect(running?.reason).toBe('an agent is working right now');
  });

  it('has no presentation for an ungrouped list or an unknown key', () => {
    expect(sessionGroupPresentation({ key: 'all', groupMode: 'none' })).toBeNull();
    expect(sessionGroupPresentation({ key: 'nope', groupMode: 'stage' })).toBeNull();
  });
});
