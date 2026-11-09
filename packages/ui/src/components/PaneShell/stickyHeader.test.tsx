// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PANE_RHYTHM } from '../../paneRhythm';
import { ListGrid } from '../ListGrid/ListGrid';
import { ListGridGroup } from '../ListGrid/ListGridGroup';
import { RevealRegion } from '../RevealRegion';
import { ScrollFade } from '../ScrollFade';
import { PageTrailContext } from './pageTrailContext';
import { PaneShell } from '.';

afterEach(cleanup);

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
