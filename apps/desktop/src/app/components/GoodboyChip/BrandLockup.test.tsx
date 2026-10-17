// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { applyDocumentTheme } from '../../../shared/lib/theme';
import { BrandLockup } from './BrandLockup';

afterEach(() => {
  cleanup();
  applyDocumentTheme({ theme: 'dark' });
});

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
  it.each(['dark', 'light'] as const)(
    'draws the same dark chip around the mark and the name in %s mode',
    (theme) => {
      applyDocumentTheme({ theme });
      const { container } = render(<BrandLockup version="0.27.0" />);

      const chip = chipOf({ container });
      expect(chip.className).toContain('goodboy-brand-chip');
      expect(chip.textContent).toBe('Goodboy');
      expect(chip.children).toHaveLength(2);
    },
  );

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

    const chip = chipOf({ container });
    expect(chip.className).toContain('goodboy-brand-chip');
    expect(container.textContent).toBe('');
  });
});
