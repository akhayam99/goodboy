// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FocusedPane } from './FocusedPane';
import { PageCrumbContext } from './PageCrumbContext';
import { PageCrumbRow } from './PageCrumbRow';
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

  it('renders the title, meta, actions, and children', () => {
    render(
      <PaneShell title="Linear" meta={3} actions={<button type="button">Link issue</button>}>
        <p>Body copy</p>
      </PaneShell>,
    );

    const heading = screen.getByRole('heading', { name: 'Linear' });
    expect(heading.className).toContain('text-lg');
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Link issue' })).toBeDefined();
    expect(screen.getByText('Body copy')).toBeDefined();
  });

  it('puts the crumb, the header, and the body in the same page column', () => {
    render(
      <PageCrumbContext.Provider value={<nav aria-label="Breadcrumb">Overview</nav>}>
        <PaneShell title="Workflows">
          <p>Body copy</p>
        </PaneShell>
      </PageCrumbContext.Provider>,
    );

    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const column = pageColumnOf(crumb);
    expect(column).not.toBeNull();
    expect(pageColumnOf(screen.getByRole('heading', { name: 'Workflows' }))).toBe(column);
    expect(pageColumnOf(screen.getByText('Body copy'))).toBe(column);
    expect(
      crumb.compareDocumentPosition(screen.getByRole('heading')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps the crumb out of the mount animation so it holds still between views', () => {
    render(
      <PageCrumbContext.Provider value={<nav aria-label="Breadcrumb">Overview</nav>}>
        <PaneShell title="Workflows">
          <p>Body copy</p>
        </PaneShell>
      </PageCrumbContext.Provider>,
    );

    expect(
      screen
        .getByRole('navigation', { name: 'Breadcrumb' })
        .closest('.motion-safe\\:animate-studio-in'),
    ).toBeNull();
    expect(
      screen
        .getByRole('heading', { name: 'Workflows' })
        .closest('.motion-safe\\:animate-studio-in'),
    ).not.toBeNull();
    expect(
      screen.getByText('Body copy').closest('.motion-safe\\:animate-studio-in'),
    ).not.toBeNull();
  });

  it('draws no crumb row outside a session', () => {
    const { container } = render(
      <PaneShell title="Settings">
        <p>Body copy</p>
      </PaneShell>,
    );

    expect(container.querySelector('[data-slot="page-crumb"]')).toBeNull();
  });

  it('bounds the body in its own scroll region and keeps the header out of it', () => {
    render(
      <PaneShell title="Resolve" scroll="body" actions={<button type="button">Start run</button>}>
        <p>Body copy</p>
      </PaneShell>,
    );

    const viewport = screen.getByText('Body copy').closest('.overflow-y-auto') as HTMLElement;

    expect(viewport.contains(screen.getByRole('heading', { name: 'Resolve' }))).toBe(false);
    expect(viewport.contains(screen.getByRole('button', { name: 'Start run' }))).toBe(false);
    expect(viewport.className).toContain('[scrollbar-gutter:stable]');
  });

  it('draws no divider under the header', () => {
    const { container } = render(
      <PaneShell title="Resolve" scroll="body">
        <p>Body copy</p>
      </PaneShell>,
    );

    expect(container.querySelector('[role="separator"]')).toBeNull();
    expect(container.querySelector('hr')).toBeNull();
  });

  it('keeps one scroller for the whole pane by default', () => {
    render(
      <PaneShell title="Resolve">
        <p>Body copy</p>
      </PaneShell>,
    );

    const viewport = screen.getByText('Body copy').closest('.overflow-y-auto') as HTMLElement;

    expect(viewport.contains(screen.getByRole('heading', { name: 'Resolve' }))).toBe(true);
  });

  it('lets the body own its scrolling with scroll self', () => {
    render(
      <PaneShell title="Transcript" scroll="self">
        <p>Body copy</p>
      </PaneShell>,
    );

    expect(screen.getByText('Body copy').closest('.overflow-y-auto')).toBeNull();
    expect(pageColumnOf(screen.getByText('Body copy'))).toBeNull();
  });

  it('renders tabs under the title and a dock on the page column', () => {
    render(
      <PaneShell
        title="Artifact"
        tabs={<span>Artifact tabs</span>}
        dock={<button type="button">Submit</button>}
      >
        <p>Body copy</p>
      </PaneShell>,
    );

    const heading = screen.getByRole('heading', { name: 'Artifact' });
    const tabs = screen.getByText('Artifact tabs');
    expect(heading.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const dock = screen.getByRole('button', { name: 'Submit' });
    expect(pageColumnOf(dock)).not.toBeNull();
    expect(dock.closest('.overflow-y-auto')).toBeNull();
  });

  it('renders a custom header in place of the title block when given one', () => {
    render(
      <PaneShell header={<h1>Custom header</h1>}>
        <p>Body copy</p>
      </PaneShell>,
    );

    expect(screen.getByRole('heading', { name: 'Custom header' })).toBeDefined();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('lets a consumer override the mount animation without touching the default', () => {
    render(
      <PaneShell header={<h1>Custom header</h1>} animationClassName="animate-fade-in">
        <p>Body copy</p>
      </PaneShell>,
    );

    const body = screen.getByText('Body copy').parentElement as HTMLElement;
    expect(body.className).toContain('animate-fade-in');
    expect(body.className).not.toContain('motion-safe:animate-studio-in');
  });
});

describe('PageCrumbRow', () => {
  it('frames the crumb in its own page column for wrappers without a header', () => {
    render(
      <PageCrumbContext.Provider value={<nav aria-label="Breadcrumb">Overview</nav>}>
        <PageCrumbRow />
      </PageCrumbContext.Provider>,
    );

    expect(pageColumnOf(screen.getByRole('navigation', { name: 'Breadcrumb' }))).not.toBeNull();
  });
});

describe('FocusedPane', () => {
  it('renders the crumb, the lens, the count, the actions, and the body', () => {
    render(
      <PageCrumbContext.Provider value={<nav aria-label="Breadcrumb">Overview</nav>}>
        <FocusedPane lens="Workflows" count={2} actions={<button type="button">Close</button>}>
          <p>Body copy</p>
        </FocusedPane>
      </PageCrumbContext.Provider>,
    );

    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(pageColumnOf(crumb)).toBe(pageColumnOf(screen.getByText('Workflows')));
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
    expect(screen.getByText('Body copy')).toBeDefined();
  });
});
