// @vitest-environment happy-dom

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppShell, StudioRailLayout } from '@goodboy/ui';
import { StudioFrame } from '../../app/components/StudioFrame';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const CHROME_FILES = ['apps/desktop/src/app/components/AppTopBar/index.tsx'];
const HORIZONTAL_DIVIDER = /<Divider(?![^>]*orientation="vertical")[^>]*\/>/;

afterEach(cleanup);

const sheetOf = (): HTMLElement => {
  const page = screen.getByText('content').closest<HTMLElement>('[data-container="page"]');
  if (page === null) {
    throw new Error('the shell must render its page container');
  }
  return page;
};

describe('the content is a sheet on the chrome', () => {
  it('wraps the sheet around the places rail when the rail is shown', () => {
    render(<AppShell leftRail={<nav aria-label="Places" />} main={<div>content</div>} />);
    const sheet = sheetOf();

    expect(sheet.dataset.sheet).toBe('wrapped');
  });

  it('leaves the sheet flush when nothing wraps it', () => {
    render(<AppShell main={<div>content</div>} />);
    const sheet = sheetOf();

    expect(sheet.dataset.sheet).toBe('flush');
  });

  it('draws no resize handle between the places rail and the sheet', () => {
    render(<AppShell leftRail={<nav aria-label="Places" />} main={<div>content</div>} />);

    expect(screen.queryByRole('separator')).toBeNull();
    expect(sheetOf().dataset.leftResize).toBeUndefined();
  });

  it('puts the studio detail on a wrapped sheet beside its rail', () => {
    render(
      <StudioRailLayout
        rail={<div>rail</div>}
        detail={<div>detail</div>}
        railLabel="Sections"
        railWidth="standard"
        surface="guide"
      />,
    );
    const detail = screen.getByText('detail').parentElement as HTMLElement;

    expect(detail.dataset.sheet).toBe('wrapped');
    expect(screen.getByRole('complementary', { name: 'Sections' })).toBeDefined();
  });

  it('draws a page with no band as the one content sheet, with no second sheet inside it', () => {
    render(
      <AppShell
        leftRail={<nav aria-label="Places" />}
        studio={
          <StudioFrame kind="impact" placement="content" onClose={() => undefined}>
            <p>page</p>
          </StudioFrame>
        }
        main={<div>content</div>}
      />,
    );
    const slot = document.querySelector('[data-studio-slot="content"]') as HTMLElement;

    expect(slot).not.toBeNull();
    expect(slot.querySelector('[data-studio-band]')).toBeNull();
    expect(slot.querySelector('[data-sheet]')).toBeNull();
    expect(slot.querySelector('[data-studio-rail]')).toBeNull();
    expect(screen.getByText('page')).toBeDefined();
  });

  it.each(CHROME_FILES)('closes %s with no horizontal divider', (path) => {
    const source = readFileSync(join(REPO_ROOT, path), 'utf8');

    expect(source).not.toMatch(HORIZONTAL_DIVIDER);
  });
});
