// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U24_THEME_SCENES } from './theme';

afterEach(cleanup);

describe('the theme toggle scenes', () => {
  it('registers the three scenes for the capture', () => {
    expect(Object.keys(U24_THEME_SCENES)).toEqual([
      'topbar-theme-dark',
      'topbar-theme-light',
      'topbar-theme-system',
    ]);
    for (const id of Object.keys(U24_THEME_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(U24_THEME_SCENES[id]);
    }
  });

  it.each([
    ['topbar-theme-dark', 'Dark theme. Switch to light'],
    ['topbar-theme-light', 'Light theme. Switch to dark'],
    ['topbar-theme-system', 'Matching system (dark). Switch to light'],
  ])('%s shows the toggle named by its tooltip', async (id, name) => {
    const Scene = U24_THEME_SCENES[id];
    if (Scene === undefined) {
      throw new Error(`missing scene ${id}`);
    }
    render(<Scene />);

    const toggle = await screen.findByRole('button', { name });

    expect(toggle.getAttribute('aria-label')).toBe(name);
  });
});
