// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sessionMenuOf } from './sessionMenuOf';

describe('sessionMenuOf', () => {
  it('holds Ask, Pin, Refresh, Archive and Delete, five rows at most while one pin state shows', () => {
    const only = sessionMenuOf({ isArchived: false });
    const showing = only.filter((id) => id !== 'session.unpin');
    expect(showing).toEqual([
      'session.ask',
      'session.pin',
      'session.refresh',
      'session.archive',
      'session.delete',
    ]);
    expect(showing).toHaveLength(5);
  });

  it('keeps only Restore and Delete on an archived session', () => {
    expect(sessionMenuOf({ isArchived: true })).toEqual(['session.restore', 'session.delete']);
  });

  it('leaves the limit, the asks state, Stop running, Rename and the lens rows to the palette and the sidebar row', () => {
    const only = sessionMenuOf({ isArchived: false });
    for (const id of [
      'session.spend',
      'session.asksNever',
      'session.asksEveryStep',
      'session.stopAll',
      'session.rename',
      'session.open',
      'session.review',
      'session.diff',
      'session.openLog',
      'session.startRun',
      'session.linkIssue',
      'session.copyTitle',
    ]) {
      expect(only).not.toContain(id);
    }
  });
});
