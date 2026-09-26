// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { UnderTrailContext } from './underTrailContext';
import { PaneActionsContext } from './paneActionsContext';
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
});
