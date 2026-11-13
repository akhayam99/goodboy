// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PANE_RHYTHM } from '../../paneRhythm';
import { ListGrid } from '../ListGrid/ListGrid';
import { ListGridGroup } from '../ListGrid/ListGridGroup';
import { RevealRegion } from '../RevealRegion';
import { ScrollFade } from '../ScrollFade';
import { PageTrailContext } from './pageTrailContext';
import { PaneShell } from '.';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const classesOf = (node: Element | null): string[] => (node?.className ?? '').split(' ');

const renderTrailPane = () =>
  render(
    <PageTrailContext.Provider value={<span>Back to artifacts</span>}>
      <PaneShell title="Report">
        <p>Body copy</p>
      </PaneShell>
    </PageTrailContext.Provider>,
  );

describe('sticky page header surface', () => {
  it('blurs the content under the pinned back row and draws no shadow', () => {
    const { container } = renderTrailPane();

    const pinned = container.querySelector('[data-slot="reveal-pinned"]');
    expect(classesOf(pinned)).toContain('sticky-surface');
    expect(pinned?.className).not.toMatch(/shadow|gradient/);
  });

  it('overlays the pinned back row on the top of the page scroller', () => {
    const { container } = renderTrailPane();

    const region = container.querySelector('[data-slot="reveal-region"]');
    const overlay = container.querySelector('[data-slot="reveal-overlay"]');
    const pinned = container.querySelector('[data-slot="reveal-pinned"]');
    const scroller = container.querySelector('[data-page-scroller]');
    expect(region?.contains(overlay ?? null)).toBe(true);
    expect(overlay?.contains(pinned)).toBe(true);
    expect(classesOf(overlay)).toEqual(
      expect.arrayContaining(['absolute', 'inset-x-0', 'top-0', 'z-30']),
    );
    expect(scroller?.contains(pinned)).toBe(false);
    expect(classesOf(scroller)).toEqual(
      expect.arrayContaining([
        'pt-[var(--reveal-inset,0px)]',
        'scroll-pt-[var(--reveal-inset,0px)]',
      ]),
    );
  });

  it('draws the hairline at the bottom of the pinned row, only once scrolled', () => {
    const { container } = renderTrailPane();

    const edge = container.querySelector('[data-slot="scroll-edge"]');
    expect(classesOf(edge)).toEqual(
      expect.arrayContaining(['top-[var(--reveal-inset,0px)]', 'opacity-0']),
    );
    expect(container.querySelector('[data-scrolled="true"]')).toBeNull();
  });

  it('parks the sliding header under the pinned row', () => {
    const { container } = renderTrailPane();

    expect(classesOf(container.querySelector('[data-slot="reveal-header"]'))).toContain(
      'top-[var(--reveal-top,0px)]',
    );
  });

  it('pads the pinned back row with more room below than above', () => {
    const { container } = renderTrailPane();

    const column = container.querySelector('[data-slot="reveal-pinned"] [data-page-column]');
    const classes = classesOf(column);
    expect(PANE_RHYTHM.pinnedInset).toBe('pt-3 pb-5');
    expect(classes).toEqual(expect.arrayContaining(['pt-3', 'pb-5']));
    expect(classes).not.toContain('py-3');
    expect(classes).not.toContain('pb-4');
  });

  it('keeps the title row off a second top inset under the pinned back row', () => {
    const { container } = renderTrailPane();

    const header = container.querySelector('[data-slot="pane-header"]');
    expect(classesOf(header)).not.toContain('pt-3');
    screen.getByRole('heading', { name: 'Report' });
  });

  it.each([
    ['under a back row', <span key="trail">Back to artifacts</span>],
    ['with no back row', null],
  ])('pins a pinned header into one even, frosted zone %s', (_, trail) => {
    const { container } = render(
      <PageTrailContext.Provider value={trail}>
        <PaneShell title="Report the session outcome" isHeaderPinned>
          <p>Body copy</p>
        </PaneShell>
      </PageTrailContext.Provider>,
    );

    const pinned = container.querySelector('[data-slot="reveal-pinned"]');
    const header = container.querySelector('[data-slot="pane-header"]');
    expect(pinned?.contains(header ?? null)).toBe(true);
    expect(classesOf(pinned)).toContain('sticky-surface');
    expect(pinned?.innerHTML).not.toMatch(/shadow|gradient/);
    expect(classesOf(pinned?.querySelector('[data-page-column]') ?? null)).toEqual(
      expect.arrayContaining(['pt-3', 'pb-5']),
    );
    expect(classesOf(header)).not.toContain('pt-3');
    expect(classesOf(header)).not.toContain('pb-5');
    expect(container.querySelector('[data-slot="reveal-header"]')?.childElementCount).toBe(0);
    expect(classesOf(container.querySelector('[data-page-scroller]'))).toEqual(
      expect.arrayContaining([
        'pt-[var(--reveal-inset,0px)]',
        'scroll-pt-[var(--reveal-inset,0px)]',
      ]),
    );
  });

  it('parks a sticky row at the padded scroller top, so the inset counts once', () => {
    const { container } = render(
      <PageTrailContext.Provider value={<span>Back to artifacts</span>}>
        <PaneShell title="Report" isHeaderPinned>
          <ListGrid label="Runs" columns={[]} isGrouped>
            <ListGridGroup label="Harborline" isSticky>
              <li>ledger-core</li>
            </ListGridGroup>
          </ListGrid>
        </PaneShell>
      </PageTrailContext.Provider>,
    );

    const label = container.querySelector('[data-list-grid-group-label]');
    const scroller = label?.closest('.overflow-y-auto') ?? null;
    expect(scroller?.hasAttribute('data-page-scroller')).toBe(true);
    expect(classesOf(scroller)).toContain('pt-[var(--reveal-inset,0px)]');
    expect(classesOf(label)).toEqual(expect.arrayContaining(['sticky', 'top-0']));
    expect(label?.className).not.toContain('--reveal-inset');
  });

  it('leaves a nested scroller unpadded, so its sticky rows start at its own top', () => {
    const { container } = render(
      <PageTrailContext.Provider value={<span>Back to artifacts</span>}>
        <PaneShell title="Report" isHeaderPinned>
          <ScrollFade isPageScroller={false}>
            <p>Nested</p>
          </ScrollFade>
        </PaneShell>
      </PageTrailContext.Provider>,
    );

    const scrollers = [...container.querySelectorAll('.overflow-y-auto')];
    expect(scrollers).toHaveLength(2);
    expect(scrollers[1]?.className).not.toContain('--reveal-inset');
  });

  it('pads the body scroller with the inset from the top of the region', () => {
    const { container } = renderTrailPane();

    const scroller = container.querySelector('[data-page-scroller]');
    expect(classesOf(scroller)).toEqual(
      expect.arrayContaining([
        'pt-[var(--reveal-inset,0px)]',
        'scroll-pt-[var(--reveal-inset,0px)]',
      ]),
    );
    expect(scroller?.closest('[data-slot="pane-body"]')).toBeNull();
  });

  it('runs a self scrolling reader up under the pinned row and pads it there', () => {
    const { container } = render(
      <PageTrailContext.Provider value={<span>Back to the branch</span>}>
        <PaneShell title="ledger-core" scroll="self">
          <ScrollFade className="min-h-0 flex-1">
            <p>Diff body</p>
          </ScrollFade>
        </PaneShell>
      </PageTrailContext.Provider>,
    );

    const scroller = container.querySelector('[data-page-scroller]');
    expect(scroller?.hasAttribute('data-under-pinned')).toBe(true);
    expect(classesOf(scroller)).toEqual(
      expect.arrayContaining([
        'pt-[var(--reveal-inset,0px)]',
        'scroll-pt-[var(--reveal-inset,0px)]',
        '-top-[var(--reveal-inset,0px)]',
        'h-[calc(100%+var(--reveal-inset,0px))]',
      ]),
    );
    expect(classesOf(scroller)).not.toContain('h-full');
    expect(classesOf(container.querySelector('[data-slot="pane-body"]'))).toContain(
      'pt-[var(--reveal-inset,0px)]',
    );
    expect(classesOf(container.querySelector('[data-slot="scroll-edge"]'))).toContain('top-0');
  });

  it('keeps a reader below a toolbar where the toolbar meets the pinned row', () => {
    const toolbarPx = 36;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const top = this.classList.contains('basis-0') ? toolbarPx : 0;
      return DOMRect.fromRect({ x: 0, y: top, width: 0, height: 0 });
    });
    const { container } = render(
      <PageTrailContext.Provider value={<span>Back to the branch</span>}>
        <PaneShell title="ledger-core" scroll="self">
          <div className="h-9">Compared with main</div>
          <ScrollFade className="min-h-0 flex-1 basis-0">
            <p>Diff body</p>
          </ScrollFade>
        </PaneShell>
      </PageTrailContext.Provider>,
    );

    const scroller = container.querySelector('[data-page-scroller]');
    expect(scroller?.hasAttribute('data-under-pinned')).toBe(false);
    expect(scroller?.className).not.toContain('--reveal-inset');
    expect(classesOf(container.querySelector('[data-slot="pane-body"]'))).toContain(
      'pt-[var(--reveal-inset,0px)]',
    );
  });

  it('adds a reader own top padding to the inset instead of dropping either', () => {
    const { container } = render(
      <PageTrailContext.Provider value={<span>Back to the branch</span>}>
        <PaneShell title="Agent" scroll="self">
          <ScrollFade className="min-h-0 flex-1" viewportClassName="pt-6">
            <p>Transcript</p>
          </ScrollFade>
        </PaneShell>
      </PageTrailContext.Provider>,
    );

    const scroller = container.querySelector<HTMLElement>('[data-page-scroller]');
    expect(scroller?.style.paddingTop).toBe('calc(var(--reveal-inset, 0px) + 24px)');
    expect(scroller?.style.scrollPaddingTop).toBe('calc(var(--reveal-inset, 0px) + 24px)');
  });

  it('pads a side scroller beside a self scrolling reader without letting it lead', () => {
    const { container } = render(
      <PageTrailContext.Provider value={<span>Back to the branch</span>}>
        <PaneShell title="ledger-core" scroll="self">
          <div className="flex min-h-0 flex-1">
            <ScrollFade className="min-h-0 flex-1">
              <p>Diff body</p>
              <ScrollFade className="max-h-40">
                <p>Hunk list</p>
              </ScrollFade>
            </ScrollFade>
            <ScrollFade className="min-h-0 w-64" isPageScroller={false}>
              <p>notify-relay/src/credit.ts</p>
            </ScrollFade>
          </div>
        </PaneShell>
      </PageTrailContext.Provider>,
    );

    const [reader, nested, tree] = [...container.querySelectorAll('.overflow-y-auto')];
    expect(reader?.hasAttribute('data-page-scroller')).toBe(true);
    expect(classesOf(reader ?? null)).toContain('pt-[var(--reveal-inset,0px)]');
    expect(nested?.className).not.toContain('--reveal-inset');
    expect(tree?.hasAttribute('data-page-scroller')).toBe(false);
    expect(tree?.hasAttribute('data-under-pinned')).toBe(true);
    expect(classesOf(tree ?? null)).toEqual(
      expect.arrayContaining([
        'pt-[var(--reveal-inset,0px)]',
        'scroll-pt-[var(--reveal-inset,0px)]',
      ]),
    );
  });

  it('hands the inset through a horizontal scroller to the reader inside it', () => {
    const { container } = render(
      <PageTrailContext.Provider value={<span>Back to the branch</span>}>
        <PaneShell title="ledger-core" scroll="self">
          <ScrollFade orientation="horizontal" className="min-h-0 flex-1">
            <ScrollFade className="min-h-0 flex-1">
              <p>Wide diff</p>
            </ScrollFade>
          </ScrollFade>
        </PaneShell>
      </PageTrailContext.Provider>,
    );

    expect(container.querySelector('.overflow-x-auto')?.className).not.toContain('--reveal-inset');
    expect(classesOf(container.querySelector('[data-page-scroller]'))).toContain(
      'pt-[var(--reveal-inset,0px)]',
    );
  });

  it('pads no scroller outside a pane', () => {
    const { container } = render(
      <ScrollFade className="min-h-0 flex-1">
        <p>Free list</p>
      </ScrollFade>,
    );

    expect(container.querySelector('.overflow-y-auto')?.className).not.toContain('--reveal-inset');
  });

  it('paints the sliding header with the same surface and no shadow', () => {
    const { container } = render(
      <RevealRegion header={<h1>Sessions</h1>}>
        <p>Body copy</p>
      </RevealRegion>,
    );

    const header = container.querySelector('[data-slot="reveal-header"]');
    expect(classesOf(header)).toContain('sticky-surface');
    expect(classesOf(header)).not.toContain('bg-background');
    expect(header?.className).not.toMatch(/shadow|gradient/);
  });

  it('paints a subtle header with the subtle surface', () => {
    const { container } = render(
      <RevealRegion header={<h1>Sessions</h1>} surface="subtle">
        <p>Body copy</p>
      </RevealRegion>,
    );

    expect(classesOf(container.querySelector('[data-slot="reveal-header"]'))).toContain(
      'sticky-surface-subtle',
    );
  });
});
