// @vitest-environment happy-dom

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppShell, StudioRailLayout } from '@goodboy/ui';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const CHROME_FILES = [
  'apps/desktop/src/app/components/AppTopBar/index.tsx',
  'apps/desktop/src/app/components/AppFooter/index.tsx',
];
const HORIZONTAL_DIVIDER = /<Divider(?![^>]*orientation="vertical")[^>]*\/>/;

afterEach(cleanup);

const sheetOf = (): HTMLElement => {
  const main = screen.getByText('content').closest('main');
  if (main === null) {
    throw new Error('the shell must render its main landmark');
  }
  return main;
};

describe('the content is a sheet on the chrome', () => {
  it('rounds the two corners the sidebar wraps and leaves the window edge square', () => {
    render(<AppShell leftSidebar={<div>sessions</div>} main={<div>content</div>} />);
    const sheet = sheetOf();

    expect(sheet.dataset.sheet).toBe('wrapped');
    expect(sheet.className).toContain('rounded-l-frame');
    expect(sheet.className).toContain('border-r-0');
    expect(sheet.className).toContain('border-frame-edge');
    expect(sheet.className).not.toMatch(/(?<![\w-])rounded-(?:r|t|b|lg|md|sm)(?![\w-])/);
  });

  it('draws only the top and bottom edge when nothing wraps it', () => {
    render(<AppShell main={<div>content</div>} />);
    const sheet = sheetOf();

    expect(sheet.dataset.sheet).toBe('flush');
    expect(sheet.className).toContain('border-y');
    expect(sheet.className).not.toMatch(/(?<![\w-])rounded/);
  });

  it('squares the sheet again while the sidebar is hidden', () => {
    render(<AppShell leftSidebar={<div>sessions</div>} leftHidden main={<div>content</div>} />);

    expect(sheetOf().dataset.sheet).toBe('flush');
  });

  it('turns the sheet edge into the resize handle on hover and drag', () => {
    render(<AppShell leftSidebar={<div>sessions</div>} main={<div>content</div>} />);
    const handle = screen.getByRole('separator', { name: 'Resize left sidebar' });

    expect(sheetOf().dataset.leftResize).toBe('idle');
    fireEvent.mouseEnter(handle);
    expect(sheetOf().dataset.leftResize).toBe('hover');
    fireEvent.mouseDown(handle, { button: 0, clientX: 100 });
    fireEvent.mouseLeave(handle);
    expect(sheetOf().dataset.leftResize).toBe('drag');
    fireEvent.mouseUp(window);
    expect(sheetOf().dataset.leftResize).toBe('idle');
    expect(sheetOf().className).toContain('data-[left-resize=hover]:border-l-border');
  });

  it('draws no resting line in the handle, the sheet edge is the line', () => {
    render(<AppShell leftSidebar={<div>sessions</div>} main={<div>content</div>} />);
    const handle = screen.getByRole('separator', { name: 'Resize left sidebar' });
    const edge = handle.firstElementChild as HTMLElement;

    expect(edge.dataset.edge).toBe('owner');
    expect(edge.className).toContain('opacity-0');
    expect(edge.className).not.toContain('group-hover:opacity-100');
  });

  it('puts a studio rail on the chrome and its detail on a wrapped sheet', () => {
    render(
      <StudioRailLayout
        rail={<div>rail</div>}
        detail={<div>detail</div>}
        railLabel="Sections"
        railWidth="standard"
      />,
    );
    const detail = screen.getByText('detail').parentElement as HTMLElement;

    expect(detail.dataset.sheet).toBe('wrapped');
    expect(detail.className).toContain('rounded-l-frame');
    expect(screen.getByRole('complementary', { name: 'Sections' }).className).not.toContain(
      'bg-background',
    );
  });

  it.each(CHROME_FILES)('closes %s with no horizontal divider', (path) => {
    const source = readFileSync(join(REPO_ROOT, path), 'utf8');

    expect(source).not.toMatch(HORIZONTAL_DIVIDER);
  });
});
