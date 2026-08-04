import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const STYLES_CSS = join(__dirname, '..', '..', 'styles.css');

describe('attention-ring animation', () => {
  it('runs a finite number of cycles, never infinite', () => {
    const source = readFileSync(STYLES_CSS, 'utf8');
    const rule = source
      .split('\n')
      .find((line) => line.includes('animation:') && line.includes('attention-ring'));

    expect(rule, 'expected a .attention-ring animation declaration in styles.css').toBeDefined();
    expect(
      rule?.includes('infinite'),
      `.attention-ring must not loop forever, an update waiting for the user does not stay in motion: ${rule?.trim()}`,
    ).toBe(false);
  });
});
