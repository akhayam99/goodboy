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
  it('wraps the sheet around the sidebar edge when the sidebar is shown', () => {
    render(<AppShell leftSidebar={<div>sessions</div>} main={<div>content</div>} />);
    const sheet = sheetOf();

    expect(sheet.dataset.sheet).toBe('wrapped');
  });

  it('leaves the sheet flush when nothing wraps it', () => {
    render(<AppShell main={<div>content</div>} />);
    const sheet = sheetOf();

    expect(sheet.dataset.sheet).toBe('flush');
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
  });

  it('gives the sheet edge to the sidebar handle as the owner of the line', () => {
    render(<AppShell leftSidebar={<div>sessions</div>} main={<div>content</div>} />);
    const handle = screen.getByRole('separator', { name: 'Resize left sidebar' });
    const edge = handle.firstElementChild as HTMLElement;

    expect(edge.dataset.edge).toBe('owner');
  });

  it('puts the studio detail on a wrapped sheet beside its rail', () => {
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
    expect(screen.getByRole('complementary', { name: 'Sections' })).toBeDefined();
  });

  it.each(CHROME_FILES)('closes %s with no horizontal divider', (path) => {
    const source = readFileSync(join(REPO_ROOT, path), 'utf8');

    expect(source).not.toMatch(HORIZONTAL_DIVIDER);
  });
});
