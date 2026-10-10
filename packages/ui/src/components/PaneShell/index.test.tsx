// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { UnderTrailContext } from './underTrailContext';
import { PaneActionsContext } from './paneActionsContext';
import { PaneBannerContext } from './paneBannerContext';
import { PaneShell } from '.';

afterEach(cleanup);

const pageColumnOf = (node: HTMLElement) => node.closest('[data-page-column]');

describe('PaneShell', () => {
  it.each(['pane', 'body', 'self'] as const)('fills a flex row parent with scroll %s', (scroll) => {
    const { container } = render(
      <div className="flex">
        <PaneShell title="Notifications" scroll={scroll}>
          <p>Body copy</p>
        </PaneShell>
      </div>,
    );

    const root = container.firstElementChild?.firstElementChild;
    expect(root?.className.split(' ')).toEqual(
      expect.arrayContaining(['min-w-0', 'flex-1', '@container']),
    );
  });

  it('scrolls a body pane under a line edge, and leaves the other two modes alone', () => {
    const edgeOf = (scroll: 'pane' | 'body' | 'self') => {
      const { container, unmount } = render(
        <PaneShell title="Notifications" scroll={scroll}>
          <p>Body copy</p>
        </PaneShell>,
      );
      const count = container.querySelectorAll('[data-slot="scroll-edge"]').length;
      unmount();
      return count;
    };

    expect(edgeOf('body')).toBe(1);
    expect(edgeOf('pane')).toBe(0);
    expect(edgeOf('self')).toBe(0);
  });

  it('keeps the body header outside the scroller the line edge belongs to', () => {
    const { container } = render(
      <PaneShell title="Notifications" scroll="body">
        <p>Body copy</p>
      </PaneShell>,
    );

    const edge = container.querySelector('[data-slot="scroll-edge"]') as HTMLElement;
    const scroller = edge.parentElement as HTMLElement;
    expect(scroller.contains(screen.getByText('Body copy'))).toBe(true);
    expect(scroller.contains(screen.getByRole('heading', { name: 'Notifications' }))).toBe(false);
  });

  it('renders the title, meta, actions, and children', () => {
    render(
      <PaneShell title="Linear" meta={3} actions={<button type="button">Link issue</button>}>
        <p>Body copy</p>
      </PaneShell>,
    );

    const heading = screen.getByRole('heading', { name: 'Linear' });
    expect(heading.className).toContain('text-title');
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Link issue' })).toBeDefined();
    expect(screen.getByText('Body copy')).toBeDefined();
  });

  it('puts the header and the body in the same page column', () => {
    render(
      <PaneShell title="Workflows">
        <p>Body copy</p>
      </PaneShell>,
    );

    const column = pageColumnOf(screen.getByRole('heading', { name: 'Workflows' }));
    expect(column).not.toBeNull();
    expect(pageColumnOf(screen.getByText('Body copy'))).toBe(column);
  });

  it('sits the title right under the trail band, with no crumb row of its own', () => {
    const { container } = render(
      <UnderTrailContext.Provider value>
        <PaneShell title="Workflows">
          <p>Body copy</p>
        </PaneShell>
      </UnderTrailContext.Provider>,
    );

    const header = container.querySelector('[data-slot="pane-header"]') as HTMLElement;
    expect(header.className).not.toContain('pt-3');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('keeps its own top inset outside a session trail band', () => {
    const { container } = render(
      <PaneShell title="Workflows">
        <p>Body copy</p>
      </PaneShell>,
    );

    const header = container.querySelector('[data-slot="pane-header"]') as HTMLElement;
    expect(header.className).toContain('pt-3');
  });

  it('adds the actions a parent hands down next to its own, once', () => {
    render(
      <PaneActionsContext.Provider value={<button type="button">Unlink</button>}>
        <PaneShell title="Outer" actions={<button type="button">Open</button>}>
          <PaneShell title="Inner">
            <p>Body copy</p>
          </PaneShell>
        </PaneShell>
      </PaneActionsContext.Provider>,
    );

    expect(screen.getAllByRole('button', { name: 'Unlink' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Open' })).toBeDefined();
  });

  it('animates the body on mount', () => {
    render(
      <PaneShell title="Workflows">
        <p>Body copy</p>
      </PaneShell>,
    );

    const body = screen.getByText('Body copy').parentElement as HTMLElement;
    expect(body.className).toContain('animate-');
  });

  it('draws the title in a fixed 32px row that never wraps, with the actions at its right', () => {
    const { container } = render(
      <PaneShell
        title="A very long page title that would otherwise push the actions onto a second line"
        actions={<button type="button">Open</button>}
      >
        <p>Body copy</p>
      </PaneShell>,
    );

    const row = container.querySelector('[data-slot="pane-title-row"]') as HTMLElement;
    const classes = row.className.split(' ');
    expect(classes).toEqual(expect.arrayContaining(['h-8', 'items-center']));
    expect(classes).not.toContain('flex-wrap');
    expect(classes).not.toContain('min-h-8');
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className.split(' ')).toEqual(expect.arrayContaining(['truncate', 'min-w-0']));
    const open = screen.getByRole('button', { name: 'Open' });
    expect(row.contains(open)).toBe(true);
    expect((open.parentElement as HTMLElement).className).toContain('shrink-0');
  });

  it('keeps the title as the first thing in the row, with no glyph before it', () => {
    const { container } = render(
      <PaneShell title="Linear">
        <p>Body copy</p>
      </PaneShell>,
    );

    const row = container.querySelector('[data-slot="pane-title-row"]') as HTMLElement;
    expect(row.firstElementChild).toBe(screen.getByRole('heading', { name: 'Linear' }));
    expect(row.querySelector('svg')).toBeNull();
  });

  it('puts the meta on one muted line under the title row', () => {
    const { container } = render(
      <PaneShell title="Scripts" meta="3 scripts">
        <p>Body copy</p>
      </PaneShell>,
    );

    const row = container.querySelector('[data-slot="pane-title-row"]') as HTMLElement;
    const meta = container.querySelector('[data-slot="pane-meta"]') as HTMLElement;
    expect(meta.textContent).toBe('3 scripts');
    expect(row.contains(meta)).toBe(false);
    expect(row.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(meta.className).toContain('truncate');
  });

  it('renders a banner handed down by the page as the first body block, once', () => {
    render(
      <PaneBannerContext.Provider value={<p>Your work is in the project folder.</p>}>
        <PaneShell title="Overview">
          <PaneShell title="Nested">
            <p>Body copy</p>
          </PaneShell>
        </PaneShell>
      </PaneBannerContext.Provider>,
    );

    const banner = screen.getByText('Your work is in the project folder.');
    const heading = screen.getByRole('heading', { name: 'Overview' });
    expect(screen.getAllByText('Your work is in the project folder.')).toHaveLength(1);
    expect(pageColumnOf(banner)).toBe(pageColumnOf(heading));
    expect(heading.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      banner.compareDocumentPosition(screen.getByText('Body copy')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('draws no banner block when the page hands none down', () => {
    const { container } = render(
      <PaneBannerContext.Provider value={null}>
        <PaneShell title="Overview">
          <p>Body copy</p>
        </PaneShell>
      </PaneBannerContext.Provider>,
    );

    expect(container.querySelector('[data-slot="pane-banner"]')).toBeNull();
  });

  it('puts a lead before a fill slot that takes the rest of a self-scrolling pane', () => {
    const { container } = render(
      <PaneShell title="Agent" scroll="self" lead={<p>Stopped notice</p>}>
        <p>Chat body</p>
      </PaneShell>,
    );

    const lead = container.querySelector('[data-slot="pane-lead"]') as HTMLElement;
    const fill = container.querySelector('[data-slot="pane-fill"]') as HTMLElement;
    const body = container.querySelector('[data-slot="pane-body"]') as HTMLElement;
    expect(lead.contains(screen.getByText('Stopped notice'))).toBe(true);
    expect(fill.contains(screen.getByText('Chat body'))).toBe(true);
    expect(lead.contains(fill)).toBe(false);
    expect(lead.compareDocumentPosition(fill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(body.contains(lead)).toBe(true);
    expect(fill.className.split(' ')).toEqual(
      expect.arrayContaining(['min-h-0', 'min-w-0', 'flex-1', 'flex-col']),
    );
    expect(lead.className.split(' ')).toContain('shrink-0');
  });

  it('wraps the children of a self-scrolling pane in the fill slot with no lead', () => {
    const { container } = render(
      <PaneShell title="Agent" scroll="self">
        <p>Chat body</p>
      </PaneShell>,
    );

    expect(container.querySelector('[data-slot="pane-lead"]')).toBeNull();
    const fill = container.querySelector('[data-slot="pane-fill"]') as HTMLElement;
    expect(fill.contains(screen.getByText('Chat body'))).toBe(true);
  });

  it('hides the lead block when what it holds renders nothing', () => {
    const Nothing = () => null;
    const { container } = render(
      <PaneShell title="Agent" scroll="self" lead={<Nothing />}>
        <p>Chat body</p>
      </PaneShell>,
    );

    const column = container.querySelector('[data-slot="pane-lead"] [data-page-column]');
    expect(column?.className.split(' ')).toContain('empty:hidden');
    expect(column?.childElementCount).toBe(0);
  });
});
