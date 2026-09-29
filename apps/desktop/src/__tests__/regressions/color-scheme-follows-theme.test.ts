// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const STYLES = readFileSync(join(__dirname, '..', '..', 'styles.css'), 'utf8');

const root = document.documentElement;
const sheet = document.createElement('style');

type Probe = {
  readonly app: HTMLElement;
  readonly icon: HTMLElement;
  readonly row: HTMLElement;
};

const mountProbe = (): Probe => {
  const app = document.createElement('div');
  app.id = 'root';
  const icon = document.createElement('button');
  icon.setAttribute('data-theme-icon', '');
  const row = document.createElement('div');
  row.style.transition = 'opacity 1s';
  app.append(icon, row);
  document.body.append(app);
  return { app, icon, row };
};

beforeAll(() => {
  document.head.append(sheet);
  sheet.textContent = STYLES;
});

afterEach(() => {
  root.removeAttribute('data-theme');
  root.removeAttribute('data-theme-switching');
  document.getElementById('root')?.remove();
});

afterAll(() => {
  sheet.remove();
});

describe('color scheme', () => {
  it('applies the light scheme to the document and app root only when the theme is light', () => {
    const dark = mountProbe();
    expect(getComputedStyle(document.body).colorScheme).toBe('dark');
    expect(getComputedStyle(dark.app).colorScheme).toBe('dark');
    dark.app.remove();

    root.setAttribute('data-theme', 'light');
    const light = mountProbe();

    expect(getComputedStyle(document.body).colorScheme).toBe('light');
    expect(getComputedStyle(light.app).colorScheme).toBe('light');
  });

  it('turns element transitions off for the frame a theme switch swaps the palette', () => {
    const idle = mountProbe();
    expect(getComputedStyle(idle.row).transition).toContain('opacity');
    idle.app.remove();

    root.setAttribute('data-theme-switching', '');
    const switching = mountProbe();

    expect(getComputedStyle(switching.row).transition).toBe('none');
  });

  it('names the toggle icon for the view transition only while a switch runs', () => {
    const idle = mountProbe();
    expect(getComputedStyle(idle.icon).getPropertyValue('view-transition-name')).not.toBe(
      'theme-icon',
    );
    idle.app.remove();

    root.setAttribute('data-theme-switching', '');
    const switching = mountProbe();

    expect(getComputedStyle(switching.icon).getPropertyValue('view-transition-name')).toBe(
      'theme-icon',
    );
  });
});
