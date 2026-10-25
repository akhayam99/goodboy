// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U28_AWAY_ALERTS_SCENES } from './AwayAlertsScene';

afterEach(cleanup);

const stateOf = (name: string): string | null =>
  screen.getByRole('switch', { name }).getAttribute('aria-checked');

describe('the away alerts scenes', () => {
  it('registers every scene for the capture', () => {
    for (const [id, Scene] of Object.entries(U28_AWAY_ALERTS_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it.each([
    ['u28-away-alerts-asked-dark', 'false'],
    ['u28-away-alerts-on-dark', 'true'],
    ['u28-away-alerts-on-light', 'true'],
  ] as const)('%s shows the banner switch %s and the badge on', (id, banner) => {
    const Scene = U28_AWAY_ALERTS_SCENES[id];
    render(<Scene />);

    expect(stateOf('Banner when you are away')).toBe(banner);
    expect(stateOf('Dock badge')).toBe('true');
  });
});
