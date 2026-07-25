// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { IntegrationGlyph, type IntegrationGlyphProvider } from './index';

afterEach(cleanup);

const CASES: ReadonlyArray<{ provider: IntegrationGlyphProvider; label: string }> = [
  { provider: 'github', label: 'GitHub' },
  { provider: 'gitlab', label: 'GitLab' },
  { provider: 'linear', label: 'Linear' },
  { provider: 'sentry', label: 'Sentry' },
];

describe('IntegrationGlyph, brand marks', () => {
  for (const { provider, label } of CASES) {
    it(`renders the ${provider} mark under the accessible name ${label}`, () => {
      render(<IntegrationGlyph provider={provider} />);
      const mark = screen.getByRole('img', { name: label });
      expect(mark.tagName.toLowerCase()).toBe('svg');
      expect(mark.querySelector('path')).not.toBeNull();
    });
  }

  it('maps every provider to a different mark', () => {
    const outlines = CASES.map(({ provider, label }) => {
      cleanup();
      render(<IntegrationGlyph provider={provider} />);
      return screen.getByRole('img', { name: label }).querySelector('path')?.getAttribute('d');
    });
    expect(new Set(outlines).size).toBe(CASES.length);
  });
});

describe('IntegrationGlyph, sizes', () => {
  it('renders the sm size by default', () => {
    render(<IntegrationGlyph provider="linear" />);
    expect(screen.getByRole('img', { name: 'Linear' }).getAttribute('width')).toBe('14');
  });

  it('shrinks the mark for the xs size', () => {
    render(<IntegrationGlyph provider="github" size="xs" />);
    expect(screen.getByRole('img', { name: 'GitHub' }).getAttribute('width')).toBe('12');
  });
});

describe('IntegrationGlyph, framed variant', () => {
  it('keeps the named mark inside a tinted frame', () => {
    render(<IntegrationGlyph provider="sentry" framed />);
    const mark = screen.getByRole('img', { name: 'Sentry' });
    expect(mark.getAttribute('width')).toBe('16');
    expect(mark.parentElement?.className).toContain('bg-provider-sentry/10');
  });
});
