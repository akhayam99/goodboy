import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GithubIcon } from '../brand-icons';
import { BrandGlyph } from './index';

afterEach(cleanup);

describe('BrandGlyph', () => {
  it('renders an unframed glyph with its size and color', () => {
    render(
      <BrandGlyph icon={GithubIcon} cssVar="--color-provider-github" size="xs" label="GitHub" />,
    );

    const glyph = screen.getByRole('img', { name: 'GitHub' });
    expect(glyph.getAttribute('width')).toBe('12');
    expect(glyph.style.color).toBe('var(--color-provider-github)');
    expect(glyph.getAttribute('class')).toContain('shrink-0');
  });

  it('renders a framed glyph with a tinted tile', () => {
    render(
      <BrandGlyph
        icon={GithubIcon}
        cssVar="--color-provider-github"
        size={26}
        framed
        label="GitHub"
      />,
    );

    const glyph = screen.getByRole('img', { name: 'GitHub' });
    const tile = glyph.parentElement;
    expect(glyph.getAttribute('width')).toBe('26');
    expect(tile?.className).toContain('size-9 rounded-lg');
    expect(tile?.style.color).toBe('var(--color-provider-github)');
  });

  it('hides an unlabeled glyph from assistive technology', () => {
    const { container } = render(<BrandGlyph icon={GithubIcon} cssVar="--color-provider-github" />);

    const glyph = container.querySelector('svg');
    expect(glyph?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
