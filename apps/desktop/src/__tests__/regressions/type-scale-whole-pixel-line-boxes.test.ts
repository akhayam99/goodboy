import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { TYPE_ROLES } from '@goodboy/ui';

const STYLES = join(__dirname, '..', '..', 'styles.css');

const css = readFileSync(STYLES, 'utf8');

const readTokenPx = ({ token }: { token: string }): number => {
  const match = new RegExp(`${token}:\\s*(\\d+(?:\\.\\d+)?)px\\s*;`).exec(css);
  if (match === null) {
    throw new Error(`styles.css must declare ${token} as a px value`);
  }
  return Number(match[1]);
};

const utilityBlock = ({ name }: { name: string }): string | null => {
  const match = new RegExp(`@utility ${name} \\{([^}]*)\\}`).exec(css);
  return match === null ? null : String(match[1]);
};

const blockPx = ({ block, property }: { block: string; property: string }): number => {
  const match = new RegExp(`(?:^|\\s)${property}:\\s*(\\d+(?:\\.\\d+)?)px;`).exec(block);
  if (match === null) {
    throw new Error(`the utility must declare ${property} in px`);
  }
  return Number(match[1]);
};

const selectorFontPx = ({ selector }: { selector: RegExp }): number => {
  const match = new RegExp(`${selector.source}\\s*\\{[^}]*font-size:\\s*(\\d+(?:\\.\\d+)?)px`).exec(
    css,
  );
  if (match === null) {
    throw new Error(`styles.css must declare a px font size for ${selector.source}`);
  }
  return Number(match[1]);
};

const themeBlock = (): string => {
  const match = /@theme \{([\s\S]*?)\n\}/.exec(css);
  if (match === null) {
    throw new Error('styles.css must declare an @theme block');
  }
  return String(match[1]);
};

const SPACING_PX = readTokenPx({ token: '--spacing' });

const isWhole = (value: number): boolean => Number.isInteger(value);

const GRADES = ['3xs', '2xs', 'xs', 'sm', 'base', 'lg', 'xl', '2xl'] as const;

type RoleBox = { readonly size: number; readonly lineHeight: number };

const roleBox = ({ role }: { role: string }): RoleBox => {
  const block = utilityBlock({ name: `text-${role}` });
  if (block !== null) {
    const sizeToken = /font-size:\s*var\((--text-[a-z0-9]+)\)/.exec(block);
    return {
      size:
        sizeToken === null
          ? blockPx({ block, property: 'font-size' })
          : readTokenPx({ token: String(sizeToken[1]) }),
      lineHeight: blockPx({ block, property: 'line-height' }),
    };
  }
  return {
    size: readTokenPx({ token: `--text-${role}` }),
    lineHeight: readTokenPx({ token: `--text-${role}--line-height` }),
  };
};

describe('type scale line boxes', () => {
  it('keeps the html root at 15px, the base every remaining rem resolves against', () => {
    expect(selectorFontPx({ selector: /\nhtml/ })).toBe(15);
  });

  it('sets unclassed text to the body role, 14px on a 20px line', () => {
    expect(selectorFontPx({ selector: /body,\s*#root/ })).toBe(14);
    expect(css).toMatch(/body,\s*#root\s*\{[^}]*line-height:\s*20px/);
  });

  it('pins every grade to a whole-pixel line box taller than its glyph', () => {
    for (const grade of GRADES) {
      const size = readTokenPx({ token: `--text-${grade}` });
      const lineHeight = readTokenPx({ token: `--text-${grade}--line-height` });

      expect(isWhole(lineHeight)).toBe(true);
      expect(lineHeight).toBeGreaterThan(size);
    }
  });

  it.each(TYPE_ROLES)('resolves the %s role to a whole-pixel line box', (role) => {
    const { size, lineHeight } = roleBox({ role });

    expect(isWhole(size)).toBe(true);
    expect(isWhole(lineHeight)).toBe(true);
    expect(lineHeight).toBeGreaterThan(size);
  });

  it('weighs only display, title, heading and row above regular', () => {
    const weighted = [...css.matchAll(/--text-([a-z]+)--font-weight:\s*(\d+);/g)].map((match) => [
      String(match[1]),
      Number(match[2]),
    ]);

    expect(Object.fromEntries(weighted)).toEqual({
      display: 600,
      title: 600,
      heading: 600,
      row: 500,
    });
  });

  it('declares no rem inside the theme', () => {
    expect(themeBlock()).not.toMatch(/\d(?:\.\d+)?rem\b/);
  });

  it('declares the spacing base in px, so a leading utility never follows the root', () => {
    expect(css).toContain(`--spacing: ${SPACING_PX}px;`);
    expect(isWhole(SPACING_PX)).toBe(true);
  });
});
