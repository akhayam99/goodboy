import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const STYLES = readFileSync(join(__dirname, '..', '..', 'styles.css'), 'utf8');

const utilityBody = (name: string): string => {
  const start = STYLES.indexOf(`@utility ${name} {`);
  if (start < 0) {
    throw new Error(`utility ${name} missing`);
  }
  const end = STYLES.indexOf('\n}\n', start);
  return STYLES.slice(start, end);
};

describe.each(['sticky-surface', 'sticky-surface-subtle'])('%s', (name) => {
  it('is a translucent surface with a light backdrop blur and no shadow', () => {
    const body = utilityBody(name);

    expect(body).toMatch(
      /background-color: color-mix\(in oklab, var\(--color-\w+\) \d+%, transparent\)/,
    );
    expect(body).toMatch(/backdrop-filter: blur\([2-4]px\)/);
    expect(body).not.toMatch(/shadow|gradient/);
  });

  it('turns opaque and drops the blur under reduced transparency', () => {
    const body = utilityBody(name);

    expect(body).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(body).toMatch(/background-color: var\(--color-\w+\);\s+backdrop-filter: none/);
  });
});

describe('scroll edge', () => {
  it('has no shade token left behind', () => {
    expect(STYLES).not.toContain('--color-scroll-edge');
  });
});
