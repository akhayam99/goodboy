// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U26P_CONTRAST_SCENES } from './ContrastScene';

afterEach(cleanup);

const rootContrast = (): string | null => document.documentElement.getAttribute('data-contrast');

describe('the contrast scenes', () => {
  it('registers the three scenes for the capture', () => {
    expect(Object.keys(U26P_CONTRAST_SCENES)).toEqual([
      'p26-contrast-standard-dark',
      'p26-contrast-more-dark',
      'p26-contrast-more-light',
    ]);
    for (const [id, Scene] of Object.entries(U26P_CONTRAST_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it.each([
    ['p26-contrast-standard-dark', null, null],
    ['p26-contrast-more-dark', 'more', null],
    ['p26-contrast-more-light', 'more', 'light'],
  ] as const)('%s sets data-contrast and the theme on the page', (id, contrast, theme) => {
    const Scene = U26P_CONTRAST_SCENES[id];
    render(<Scene />);

    expect(rootContrast()).toBe(contrast);
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
    screen.getByRole('switch', { name: 'More contrast' });
  });

  it('puts the page back to standard contrast when the scene goes away', () => {
    const Scene = U26P_CONTRAST_SCENES['p26-contrast-more-dark'];
    const { unmount } = render(<Scene />);
    expect(rootContrast()).toBe('more');

    unmount();

    expect(rootContrast()).toBeNull();
  });
});
