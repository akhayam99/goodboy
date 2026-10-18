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
  it('paints the dark chrome and primary the splash paints', () => {
    const chrome = tokenIn({ block: DARK_BLOCK, name: '--color-chrome' });
    const primary = tokenIn({ block: DARK_BLOCK, name: '--color-primary' });
    expect(chrome).not.toBe('');
    expect(html).toContain(`--shell-chrome: ${chrome};`);
    expect(html).toContain(`--shell-primary: ${primary};`);
  });

  it('starts light for a light theme, with the light chrome and primary', () => {
    const chrome = tokenIn({ block: LIGHT_BLOCK, name: '--color-chrome' });
    const primary = tokenIn({ block: LIGHT_BLOCK, name: '--color-primary' });
    expect(chrome).not.toBe('');
    const lightRule = html.match(/html\[data-theme='light'\] \{[^}]*\}/)?.[0] ?? '';
    expect(lightRule).toContain(`--shell-chrome: ${chrome};`);
    expect(lightRule).toContain(`--shell-primary: ${primary};`);
    expect(lightRule).toContain('color-scheme: light');
    expect(html).toContain("setAttribute('data-theme', 'light')");
  });

  it('uses the same 6% cover strength as the splash and the Welcome cover', () => {
    expect(styles).toMatch(/--app-backdrop-cover-strength: 6;/);
    expect(styles).toMatch(/--app-backdrop-strength: 3;/);
    expect(html).toContain('var(--shell-primary) 6%');
  });

  it('paints the light cover at the cover strength times the light backdrop scale', () => {
    const scale = Number(
      styles.match(/html\[data-theme='light'\] \{\s*--app-backdrop-scale: ([\d.]+);\s*\}/)?.[1],
    );
    const lightRule = html.match(/html\[data-theme='light'\] \{[\s\S]*?\n      \}/)?.[0] ?? '';
    expect(scale).toBeGreaterThan(1);
    expect(lightRule).toContain(`var(--shell-primary) ${6 * scale}%`);
  });

  it('draws the 84px brand tile at the splash anchor and no text', () => {
    expect(html).toContain('width: 84px;');
    expect(html).toContain('top: calc(50% - 95px);');
    expect(html).toContain('#0b0b0d');
    expect(html).not.toMatch(/<(strong|span|small)\b/);
  });

  it('opens the native window on dark chrome, never the old gray', () => {
    expect(tauriConf).toContain('"backgroundColor": "#0e1012"');
    expect(tauriConf).not.toContain('#202225');
  });
});
