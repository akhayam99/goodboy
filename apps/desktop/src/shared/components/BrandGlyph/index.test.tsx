import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GithubIcon } from '@goodboy/ui';
import { BrandGlyph } from '@goodboy/ui';

afterEach(cleanup);

describe('BrandGlyph', () => {
  it('renders a glyph with its semantic size and brand color', () => {
    render(
      <BrandGlyph icon={GithubIcon} cssVar="--color-provider-github" size="xs" label="GitHub" />,
    );

    const glyph = screen.getByRole('img', { name: 'GitHub' });
    expect(glyph.getAttribute('width')).toBe('12');
    expect(glyph.style.color).toBe('var(--color-provider-github)');
    expect(glyph.getAttribute('class')).toContain('shrink-0');
  });

  it('renders a numeric size without a wrapper tile', () => {
    render(
      <BrandGlyph icon={GithubIcon} cssVar="--color-provider-github" size={20} label="GitHub" />,
    );

    const glyph = screen.getByRole('img', { name: 'GitHub' });
    expect(glyph.getAttribute('width')).toBe('20');
    expect(glyph.parentElement?.tagName).toBe('DIV');
    expect(glyph.parentElement?.className).not.toContain('rounded');
  });

  it('hides an unlabeled glyph from assistive technology', () => {
    const { container } = render(<BrandGlyph icon={GithubIcon} cssVar="--color-provider-github" />);

    const glyph = container.querySelector('svg');
    expect(glyph?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
