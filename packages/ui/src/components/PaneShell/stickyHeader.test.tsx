// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PANE_RHYTHM } from '../../paneRhythm';
import { RevealRegion } from '../RevealRegion';
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

  it('pads the pinned back row the same above and below', () => {
    const { container } = renderTrailPane();

    const column = container.querySelector('[data-slot="reveal-pinned"] [data-page-column]');
    const classes = classesOf(column);
    expect(PANE_RHYTHM.pinnedInset).toBe('py-3');
    expect(classes).toContain('py-3');
    expect(classes).not.toContain('pt-3');
    expect(classes).not.toContain('pb-3');
  });

  it('keeps the title row off a second top inset under the pinned back row', () => {
    const { container } = renderTrailPane();

    const header = container.querySelector('[data-slot="pane-header"]');
    expect(classesOf(header)).not.toContain('pt-3');
    expect(screen.getByRole('heading', { name: 'Report' })).toBeDefined();
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
