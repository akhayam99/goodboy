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

describe('drop-chip', () => {
  const body = utilityBody('drop-chip');

  it('paints floating at 76% over a 14px saturated blur', () => {
    expect(body).toContain('color-mix(in oklab, var(--color-floating) 76%, transparent)');
    expect(body).toContain('blur(var(--drop-chip-blur, 14px)) saturate(1.5)');
  });

  it('falls back to opaque floating with no blur under reduced transparency', () => {
    expect(body).toMatch(
      /prefers-reduced-transparency: reduce\) \{\s*background-color: var\(--color-floating\);\s*backdrop-filter: none;/,
    );
  });

  it('draws a hairline and a highlight fill under forced colors', () => {
    expect(body).toContain('forced-colors: active');
    expect(body).toContain('CanvasText');
    expect(body).toContain('Highlight');
  });
});

describe('drop-ghost', () => {
  const body = utilityBody('drop-ghost');

  it('is a 2px ring in primary at 62% with a 5% wash and a page-coloured hairline', () => {
    expect(body).toContain('var(--color-primary) 62%');
    expect(body).toContain('var(--color-primary) 5%');
    expect(body).toContain('0 0 0 1px var(--color-background)');
  });

  it('moves only when motion is allowed', () => {
    expect(body).toMatch(/prefers-reduced-motion: no-preference\) \{\s*transition:/);
  });
});
