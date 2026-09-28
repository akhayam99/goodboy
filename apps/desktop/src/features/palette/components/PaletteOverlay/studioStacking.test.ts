import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesCssPath = resolve(__dirname, '../../../../styles.css');

const readZIndexToken = (name: string): number => {
  const css = readFileSync(stylesCssPath, 'utf8');
  const match = css.match(new RegExp(`--z-index-${name}:\\s*([0-9]+);`));
  if (!match) {
    throw new Error(`--z-index-${name} not found in styles.css`);
  }
  return Number(match[1]);
};

describe('command palette summoned over an open app-global popover', () => {
  it('sits above the popover layer in the named z-scale', () => {
    const popover = readZIndexToken('popover');
    const commandPalette = readZIndexToken('command-palette');
    expect(commandPalette).toBeGreaterThan(popover);
  });
});
