// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP = join(__dirname, '..', '..', '..');
const html = readFileSync(join(DESKTOP, 'index.html'), 'utf8');
const styles = readFileSync(join(DESKTOP, 'src', 'styles.css'), 'utf8');
const tauriConf = readFileSync(join(DESKTOP, 'src-tauri', 'tauri.conf.json'), 'utf8');

const DARK_BLOCK = /@theme \{[\s\S]*?\n\}/;
const LIGHT_BLOCK = /html\[data-theme='light'\] \{[\s\S]*?\n\}/;

const tokenIn = ({ block, name }: { readonly block: RegExp; readonly name: string }): string => {
  const source = styles.match(block)?.[0] ?? '';
  return source.match(new RegExp(`${name}: (oklch\\([^)]+\\))`))?.[1] ?? '';
};

describe('boot shell', () => {
  it('paints the dark chrome the splash paints', () => {
    const chrome = tokenIn({ block: DARK_BLOCK, name: '--color-chrome' });
    expect(chrome).not.toBe('');
    expect(html).toContain(`--shell-chrome: ${chrome};`);
  });

  it('starts light for a light theme, with the light chrome', () => {
    const chrome = tokenIn({ block: LIGHT_BLOCK, name: '--color-chrome' });
    expect(chrome).not.toBe('');
    const lightRule = html.match(/html\[data-theme='light'\] \{[^}]*\}/)?.[0] ?? '';
    expect(lightRule).toContain(`--shell-chrome: ${chrome};`);
    expect(lightRule).toContain('color-scheme: light');
    expect(html).toContain("setAttribute('data-theme', 'light')");
  });

  it('paints flat chrome with no glow behind the window, like the splash and the shell', () => {
    expect(html).not.toMatch(/gradient/);
    expect(styles).not.toMatch(/--app-backdrop/);
    expect(styles).toMatch(
      /@utility bg-backdrop \{\s*background-color: var\(--color-chrome\);\s*\}/,
    );
    expect(styles).toMatch(
      /@utility bg-backdrop-cover \{\s*background-color: var\(--color-chrome\);\s*\}/,
    );
  });

  it('draws the 84px brand tile at the splash anchor and no text', () => {
    expect(html).toContain('width: 84px;');
    expect(html).toContain('top: calc(50% - 95px);');
    expect(html).toContain('#0b0b0d');
    expect(html).not.toMatch(/<(strong|span|small)\b/);
  });

  it('opens the native window on dark chrome, never the old gray', () => {
    expect(tauriConf).toContain('"backgroundColor": "#0d0e10"');
    expect(tauriConf).not.toContain('#202225');
  });
});
