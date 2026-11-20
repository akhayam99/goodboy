// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sessionMenuOf } from './sessionMenuOf';

describe('sessionMenuOf', () => {
  it('holds Pin, Link work, the copies, Archive and Delete while one pin state shows', () => {
    const only = sessionMenuOf({ isArchived: false });
    expect(only.filter((id) => id !== 'session.unpin')).toEqual([
      'session.pin',
      'session.linkIssue',
      'session.copyTitle',
      'session.copyBranch',
      'session.copyWorktreePath',
      'session.copyPr',
      'session.archive',
      'session.delete',
    ]);
  });

  it('keeps only Restore and Delete on an archived session', () => {
    expect(sessionMenuOf({ isArchived: true })).toEqual(['session.restore', 'session.delete']);
  });

  it('leaves Ask, Refresh, the limit, the run setting, Stop running and the open rows to the palette and the right click', () => {
    const only = sessionMenuOf({ isArchived: false });
    for (const id of [
      'session.ask',
      'session.refresh',
      'session.writeFromWork',
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
    ]) {
      expect(only).not.toContain(id);
    }
  });
});
