// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PAGE_MEASURE } from '../../frameGeometry';
import { PANE_RHYTHM } from '../../paneRhythm';
import { PaneActionsContext } from './paneActionsContext';
import { UnderTrailContext } from './underTrailContext';
import { PageHeader } from './PageHeader';
import { PaneShell } from '.';

afterEach(cleanup);

const headerOf = (title: string): HTMLElement => {
  const header = screen
    .getByRole('heading', { name: title })
    .closest<HTMLElement>('[data-page-header]');
  if (header === null) {
    throw new Error(`${title} has no page header`);
  }
  return header;
};

describe('PageHeader', () => {
  it('owns the 12px top inset and the 32px title row of every page', () => {
    render(<PageHeader page="board" title="Sessions" />);

    const header = headerOf('Sessions');
    expect(PANE_RHYTHM.headerInset).toBe('pt-3');
    expect(header.className.split(' ')).toContain('pt-3');
    expect(header.getAttribute('data-page')).toBe('board');
    expect(header.querySelector('[data-slot="pane-title-row"]')?.className).toContain('h-8');
  });

  it('puts the header on the measure of its page kind', () => {
    render(<PageHeader page="chat" title="New chat" />);

    const column = headerOf('New chat').closest('[data-page-column]');
    expect(column?.getAttribute('data-width')).toBe(PAGE_MEASURE.chat);
  });

  it('adds no top inset under a studio band', () => {
    render(
      <UnderTrailContext.Provider value>
        <PageHeader page="terminal" title="Terminal" />
      </UnderTrailContext.Provider>,
    );

    expect(headerOf('Terminal').className.split(' ')).not.toContain('pt-3');
  });

  it('ends the title row with the Close the frame hands down', () => {
    render(
      <PaneActionsContext.Provider value={<button type="button">Close</button>}>
        <PageHeader page="monitoring" title="Monitoring" />
      </PaneActionsContext.Provider>,
    );

    const row = headerOf('Monitoring').querySelector('[data-slot="pane-title-row"]');
    expect(row?.contains(screen.getByRole('button', { name: 'Close' }))).toBe(true);
  });

  it('is the header PaneShell draws, on the measure of the page it names', () => {
    render(
      <PaneShell page="overview" title="Overview">
        <p>Body copy</p>
      </PaneShell>,
    );

    const header = headerOf('Overview');
    expect(header.getAttribute('data-page')).toBe('overview');
    expect(header.closest('[data-page-column]')?.getAttribute('data-width')).toBe(
      PAGE_MEASURE.overview,
    );
    expect(screen.getByText('Body copy').closest('[data-page-column]')).toBe(
      header.closest('[data-page-column]'),
    );
  });
});
