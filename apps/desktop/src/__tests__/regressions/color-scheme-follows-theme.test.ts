import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const STYLES = readFileSync(join(__dirname, '..', '..', 'styles.css'), 'utf8');

describe('color scheme', () => {
  it('applies the light scheme to the document and app root', () => {
    expect(STYLES).toMatch(
      /html\[data-theme='light'\] body,\s*html\[data-theme='light'\] #root \{\s*color-scheme: light;/,
    );
  });

  it('turns element transitions off for the frame a theme switch swaps the palette', () => {
    expect(STYLES).toMatch(
      /html\[data-theme-switching\] \*,\s*html\[data-theme-switching\] \*::before,\s*html\[data-theme-switching\] \*::after \{\s*transition: none !important;/,
    );
  });
});
