// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U24_THEME_SCENES } from './theme';

afterEach(cleanup);

describe('the Settings theme scenes', () => {
  it('registers the three scenes for the capture', () => {
    expect(Object.keys(U24_THEME_SCENES)).toEqual([
      'settings-theme-dark',
      'settings-theme-light',
      'settings-theme-system',
    ]);
    for (const id of Object.keys(U24_THEME_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(U24_THEME_SCENES[id]);
    }
  });

  it.each([
    ['settings-theme-dark', 'Dark'],
    ['settings-theme-light', 'Light'],
    ['settings-theme-system', 'System'],
  ])('%s shows the Theme control with %s picked', async (id, picked) => {
    const Scene = U24_THEME_SCENES[id];
    if (Scene === undefined) {
      throw new Error(`missing scene ${id}`);
    }
    render(<Scene />);

    const tab = await screen.findByRole('tab', { name: picked });

    expect(tab.getAttribute('aria-selected')).toBe('true');
  });
});
