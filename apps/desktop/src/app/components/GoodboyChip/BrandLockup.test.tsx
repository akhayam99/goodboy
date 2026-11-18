// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { applyDocumentTheme } from '../../../shared/lib/theme';
import { STYLES_PATH } from '../../../test/styleTokens';
import { BrandLockup } from './BrandLockup';

afterEach(() => {
  cleanup();
  applyDocumentTheme({ theme: 'dark' });
});

type ThemeParams = {
  readonly theme: 'dark' | 'light';
};

type ChipParams = {
  readonly container: HTMLElement;
};

const chipOf = ({ container }: ChipParams): HTMLElement => {
  const chip = container.querySelector<HTMLElement>('[data-brand-chip]');
  if (chip === null) {
    throw new Error('no brand chip');
  }
  return chip;
};

describe('BrandLockup', () => {
  it('draws the same mark chip in light and dark', () => {
    const markupIn = ({ theme }: ThemeParams): string => {
      applyDocumentTheme({ theme });
      const { container, unmount } = render(<BrandLockup />);
      const markup = container.innerHTML;
      unmount();
      return markup;
    };

    expect(markupIn({ theme: 'light' })).toBe(markupIn({ theme: 'dark' }));
  });

  it('takes the accent inside the chip from brand-accent, not from primary', () => {
    const css = readFileSync(STYLES_PATH, 'utf8');
    const start = css.indexOf('.goodboy-brand-chip {');
    const rule = css.slice(start, css.indexOf('}', start));

    expect(rule).toContain('--color-primary: var(--color-brand-accent);');
  });

  it('draws only the mark in the chip, no name and no version', () => {
    const { container } = render(<BrandLockup />);

    expect(chipOf({ container }).querySelector('span')).not.toBeNull();
    expect(container.textContent).toBe('');
  });
});
