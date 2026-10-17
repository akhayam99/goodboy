// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { applyDocumentTheme } from '../../../shared/lib/theme';
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
  it('draws the same chip around the mark and the name in light and dark', () => {
    const markupIn = ({ theme }: ThemeParams): string => {
      applyDocumentTheme({ theme });
      const { container, unmount } = render(<BrandLockup version="0.27.0" />);
      const chip = chipOf({ container });
      expect(chip.textContent).toBe('Goodboy');
      expect(chip.children).toHaveLength(2);
      const markup = container.innerHTML;
      unmount();
      return markup;
    };

    expect(markupIn({ theme: 'light' })).toBe(markupIn({ theme: 'dark' }));
  });

  it('keeps Beta and the version outside the chip, in theme text', () => {
    const { container } = render(<BrandLockup version="0.27.0" />);

    const chip = chipOf({ container });
    expect(chip.textContent).not.toContain('Beta');
    expect(chip.textContent).not.toContain('0.27.0');
    expect(container.textContent).toBe('GoodboyBetav0.27.0');
  });

  it('drops the version when the build stamped none', () => {
    const { container } = render(<BrandLockup version={null} />);

    expect(container.textContent).toBe('GoodboyBeta');
  });

  it('draws only the mark in the chip on the rail', () => {
    const { container } = render(<BrandLockup version="0.27.0" isMarkOnly />);

    expect(chipOf({ container }).querySelector('span')).not.toBeNull();
    expect(container.textContent).toBe('');
  });
});
