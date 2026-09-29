import { beforeEach, describe, expect, it, vi } from 'vitest';

let ring: typeof import('./actionRing');

beforeEach(async () => {
  vi.resetModules();
  ring = await import('./actionRing');
});

describe('actionRing', () => {
  it('keeps the last ten names, oldest first, and folds repeats', () => {
    ring.recordShortcut({ id: 'palette.open' });
    ring.recordShortcut({ id: 'palette.open' });
    for (const id of ['nav.back', 'nav.forward'] as const) {
      Array.from({ length: 6 }, () => {
        ring.recordShortcut({ id });
        ring.recordScreen({ label: 'Board' });
      });
    }

    expect(ring.recentActions()).toHaveLength(ring.ACTION_RING_LIMIT);
    expect(ring.recentActions().at(-1)).toBe('screen.board');
    expect(ring.recentActions()).not.toContain('palette.open');
  });

  it('names a screen from its label, never its content', () => {
    expect(ring.screenActionName({ label: 'Session › Agents' })).toBe('screen.session.agents');
    expect(ring.screenActionName({ label: 'Settings · App' })).toBe('screen.settings.app');
    expect(ring.screenActionName({ label: 'Session › Pull request' })).toBe(
      'screen.session.pull-request',
    );
  });

  it('refuses anything that is not a short dotted name', () => {
    for (const name of ['send prompt fix the refund', 'Rowan', 'a.b.c.d.e.f', 'x'.repeat(60), '']) {
      expect(ring.isActionName({ name })).toBe(false);
    }
    expect(ring.isActionName({ name: 'lens.agents' })).toBe(true);
  });
});

import { it, expect } from 'vitest';
it('probe fails', () => { expect(1).toBe(2); });
