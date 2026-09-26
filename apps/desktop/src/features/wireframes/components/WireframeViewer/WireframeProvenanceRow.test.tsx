// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WireframeProvenanceRow } from './WireframeProvenanceRow';

afterEach(cleanup);

const theme = {
  name: 'goodboy',
  font: 'sans',
  radius: 'md',
  sources: ['packages/ui/src/styles.css'],
} as const;

describe('WireframeProvenanceRow', () => {
  it('names the fidelity, the theme, the commit and the design file behind it', () => {
    render(
      <WireframeProvenanceRow
        fidelity="low"
        theme={JSON.parse(JSON.stringify(theme))}
        designProfile={{ commitSha: 'abcdef1' }}
      />,
    );
    const provenance = screen.getByTestId('wireframe-provenance');
    expect(provenance.textContent).toContain('low fidelity');
    expect(provenance.textContent).toContain('theme goodboy');
    expect(provenance.textContent).toContain('abcdef1');
    const chip = screen.getByTestId('wireframe-source-chip');
    expect(chip.textContent).toBe('styles.css');
    expect(chip.getAttribute('title')).toBe('packages/ui/src/styles.css');
  });

  it('keeps every design source on one row and reveals the rest on demand', () => {
    render(
      <WireframeProvenanceRow
        fidelity="high"
        theme={JSON.parse(
          JSON.stringify({
            ...theme,
            sources: [
              'packages/ui/src/styles.css',
              'packages/ui/src/tokens.css',
              'apps/desktop/src/app/theme.ts',
              'apps/desktop/tailwind.config.ts',
              'packages/ui/src/Button.tsx',
            ],
          }),
        )}
        designProfile={{}}
      />,
    );
    expect(screen.getAllByTestId('wireframe-source-chip')).toHaveLength(4);
    const more = screen.getByTestId('wireframe-sources-more');
    expect(more.textContent).toBe('+1 more');
    fireEvent.click(more);
    expect(screen.getAllByTestId('wireframe-source-chip')).toHaveLength(5);
    expect(screen.getByTestId('wireframe-sources-less')).toBeDefined();
  });

  it('says so when nothing was pinned to the wireframe', () => {
    render(
      <WireframeProvenanceRow
        fidelity="low"
        theme={JSON.parse(JSON.stringify({ name: 'generic' }))}
        designProfile={{}}
      />,
    );
    expect(screen.getByTestId('wireframe-provenance').textContent).toContain(
      'no design evidence was pinned',
    );
  });
});
