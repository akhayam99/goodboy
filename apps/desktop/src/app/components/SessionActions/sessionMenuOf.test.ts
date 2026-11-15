// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sessionMenuOf } from './sessionMenuOf';

describe('sessionMenuOf', () => {
  it('keeps only the rows with no control beside them, five at most while one state shows', () => {
    const { only } = sessionMenuOf({ limitUsd: null });
    const showing = only.filter((id) => id !== 'session.autopilotOff' && id !== 'session.restore');
    expect(showing).toEqual([
      'session.spend',
      'session.autopilotOn',
      'session.stopAll',
      'session.archive',
      'session.delete',
    ]);
    expect(showing).toHaveLength(5);
  });

  it('drops Pin, Refresh, Rename, the lens rows and the copies from the rail menu', () => {
    const { only } = sessionMenuOf({ limitUsd: null });
    for (const id of [
      'session.pin',
      'session.unpin',
      'session.refresh',
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

  it('shows the limit and the Autopilot state in the rows', () => {
    expect(sessionMenuOf({ limitUsd: null }).relabel.get('session.spend')).toBe('Limit: none');
    expect(sessionMenuOf({ limitUsd: 5 }).relabel.get('session.spend')).toBe('Limit: $5.00');
    const { relabel } = sessionMenuOf({ limitUsd: null });
    expect(relabel.get('session.autopilotOn')).toBe('Autopilot: off');
    expect(relabel.get('session.autopilotOff')).toBe('Autopilot: on');
  });
});
