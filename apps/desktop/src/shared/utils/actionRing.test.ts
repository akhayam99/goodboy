import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACTION_RING_LIMIT,
  clearActions,
  isActionName,
  recentActions,
  recordScreen,
  recordShortcut,
  screenActionName,
} from './actionRing';

beforeEach(() => {
  clearActions();
});

describe('actionRing', () => {
  it('keeps the last ten names, oldest first, and folds repeats', () => {
    recordShortcut({ id: 'palette.open' });
    recordShortcut({ id: 'palette.open' });
    for (const id of ['nav.back', 'nav.forward'] as const) {
      Array.from({ length: 6 }, () => {
        recordShortcut({ id });
        recordScreen({ label: 'Board' });
      });
    }

    expect(recentActions()).toHaveLength(ACTION_RING_LIMIT);
    expect(recentActions().at(-1)).toBe('screen.board');
    expect(recentActions()).not.toContain('palette.open');
  });

  it('names a screen from its label, never its content', () => {
    expect(screenActionName({ label: 'Session › Agents' })).toBe('screen.session.agents');
    expect(screenActionName({ label: 'Settings · App' })).toBe('screen.settings.app');
    expect(screenActionName({ label: 'Session › Pull request' })).toBe(
      'screen.session.pull-request',
    );
  });

  it('refuses anything that is not a short dotted name', () => {
    for (const name of ['send prompt fix the refund', 'Rowan', 'a.b.c.d.e.f', 'x'.repeat(60), '']) {
      expect(isActionName({ name })).toBe(false);
    }
    expect(isActionName({ name: 'lens.agents' })).toBe(true);
  });
});
