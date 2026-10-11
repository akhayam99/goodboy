import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  AppShell,
  DRAWER_INSET,
  RIGHT_DRAWER_MAX,
  RIGHT_DRAWER_STORAGE_KEY,
  STUDIO_RAIL_WIDTHS,
  studioRailFoldKey,
  studioRailStorageKey,
} from '@goodboy/ui';
import { StudioFrame } from '../../../../app/components/StudioFrame';
import { InboxStudioLayout } from './InboxStudioLayout';

const BASE_PROPS = {
  rail: <nav aria-label="Filter tasks">facets</nav>,
  railHeader: <p>search</p>,
  list: () => <p>rows</p>,
};

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const stubColumnWidth = (width: number) => {
  class StubObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe() {
      this.callback([{ contentRect: { width } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
};

const renderInShell = ({ drawer }: { readonly drawer: string | null }) =>
  render(
    <AppShell
      leftSidebar={<div>sessions</div>}
      main={<div>board</div>}
      studioCoversLeft={false}
      studio={
        <StudioFrame kind="inbox" placement="content" onClose={() => undefined}>
          <InboxStudioLayout
            rail={<nav aria-label="Filter tasks">facets</nav>}
            railHeader={<p>search</p>}
            list={() => <p>rows</p>}
            drawer={drawer === null ? null : <p>{drawer}</p>}
          />
        </StudioFrame>
      }
    />,
  );

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

type LayoutProps = Partial<ComponentProps<typeof InboxStudioLayout>>;

const renderLayout = (props: LayoutProps = {}) =>
  render(
    <InboxStudioLayout
      rail={<nav aria-label="Filter tasks">facets</nav>}
      railHeader={<p>search</p>}
      list={() => <p>rows</p>}
      drawer={null}
      {...props}
    />,
  );

const rail = () => screen.getByRole('complementary', { name: 'Task filters' });

describe('InboxStudioLayout', () => {
  it('docks the filters in a rail beside the list, 288 wide, under the key Tasks used before 0.22', () => {
    renderLayout();

    expect(rail().contains(screen.getByRole('navigation', { name: 'Filter tasks' }))).toBe(true);
    expect(screen.getByText('rows')).toBeDefined();
    expect(
      screen.getByRole('separator', { name: 'Resize task filters' }).getAttribute('aria-valuenow'),
    ).toBe(String(STUDIO_RAIL_WIDTHS.standard));
  });

  it('reads the width saved under the inbox key', () => {
    localStorage.setItem(studioRailStorageKey({ surface: 'inbox' }), '340');

    renderLayout();

    expect(
      screen.getByRole('separator', { name: 'Resize task filters' }).getAttribute('aria-valuenow'),
    ).toBe('340');
  });

  it('folds the rail from its first row, remembers it and tells the list', () => {
    const states: boolean[] = [];
    renderLayout({
      list: ({ isRailCollapsed }) => {
        states.push(isRailCollapsed);
        return <p>rows</p>;
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fold the rail' }));

    expect(screen.queryByRole('complementary', { name: 'Task filters' })).toBeNull();
    expect(localStorage.getItem(studioRailFoldKey({ surface: 'inbox' }))).toBe('1');
    expect(states[states.length - 1]).toBe(true);
  });

  it('hands the list a dock action only while the pane is wide enough', () => {
    localStorage.setItem(studioRailFoldKey({ surface: 'inbox' }), '1');
    let dock: (() => void) | undefined;
    renderLayout({
      list: ({ onDock }) => {
        dock = onDock;
        return <p>rows</p>;
      },
    });

    expect(screen.queryByRole('complementary', { name: 'Task filters' })).toBeNull();
    expect(dock).toBeDefined();
  });

  it('keeps the drawer column closed while nothing is open', () => {
    renderLayout();

    const drawer = screen.getByRole('complementary', { name: 'Task' });
    expect(drawer.getAttribute('data-drawer-mode')).toBe('closed');
    expect(drawer.style.width).toBe('0px');
  });

  it('opens the record in a drawer at the one saved width, clamped', () => {
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, '900');

    renderLayout({ drawer: <p>record</p> });

    const drawer = screen.getByRole('complementary', { name: 'Task' });
    expect(drawer.style.width).toBe(`${RIGHT_DRAWER_MAX + DRAWER_INSET * 2}px`);
    expect(drawer.getAttribute('data-drawer-mode')).toBe('push');
  });

  it('saves the width the drawer is resized to', () => {
    renderLayout({ drawer: <p>record</p> });

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize the item panel' }), {
      key: 'ArrowLeft',
    });

    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBe('408');
  });
});

describe('InboxStudioLayout inside the Tasks studio', () => {
  it('hands the sheet to the page container, band and list inside it', () => {
    stubColumnWidth(1600);
    const { container } = renderInShell({ drawer: null });
    const slot = container.querySelector<HTMLElement>('[data-studio-slot="content"]');
    const page = slot?.querySelector<HTMLElement>('[data-container="page"]');

    expect(slot?.querySelector('[data-studio-sheet-owner]')).not.toBeNull();
    expect(page?.dataset['sheet']).toBe('wrapped');
    expect(page?.querySelector('[data-studio-band]')).not.toBeNull();
    expect(page?.textContent).toContain('rows');
    expect(slot?.querySelectorAll('[data-sheet]')).toHaveLength(1);
  });

  it('stands the Task drawer beside the page container, never inside it', () => {
    stubColumnWidth(1600);
    const { container } = renderInShell({ drawer: 'record' });
    const slot = container.querySelector<HTMLElement>('[data-studio-slot="content"]');
    const page = slot?.querySelector<HTMLElement>('[data-container="page"]');
    const drawer = slot?.querySelector<HTMLElement>('[data-container="drawer"]');

    expect(
      screen.getByRole('complementary', { name: 'Task' }).getAttribute('data-drawer-mode'),
    ).toBe('push');
    expect(page?.dataset['sheet']).toBe('pushed');
    expect(drawer?.textContent).toContain('record');
    expect(page?.contains(drawer ?? null)).toBe(false);
    expect(page?.contains(screen.getByText('rows'))).toBe(true);
  });

  it('lifts the Task drawer over the page container on a narrow window, band included', () => {
    stubColumnWidth(900);
    const { container } = renderInShell({ drawer: 'record' });
    const slot = container.querySelector<HTMLElement>('[data-studio-slot="content"]');
    const page = slot?.querySelector<HTMLElement>('[data-container="page"]');

    expect(
      screen.getByRole('complementary', { name: 'Task' }).getAttribute('data-drawer-mode'),
    ).toBe('overlay');
    expect(page?.hasAttribute('inert')).toBe(true);
    expect(slot?.querySelector('[data-drawer-scrim]')).not.toBeNull();
    expect(page?.querySelector('[data-studio-band]')).not.toBeNull();
  });

  it('closes the drawer container when the record is deselected', () => {
    stubColumnWidth(1600);
    const view = renderInShell({ drawer: 'record' });
    view.rerender(
      <AppShell
        leftSidebar={<div>sessions</div>}
        main={<div>board</div>}
        studioCoversLeft={false}
        studio={
          <StudioFrame kind="inbox" placement="content" onClose={() => undefined}>
            <InboxStudioLayout {...BASE_PROPS} drawer={null} />
          </StudioFrame>
        }
      />,
    );

    expect(
      screen.getByRole('complementary', { name: 'Task' }).getAttribute('data-drawer-mode'),
    ).toBe('closed');
    expect(
      view.container.querySelector('[data-container="page"]')?.getAttribute('data-sheet'),
    ).toBe('wrapped');
  });

  it('keeps the card inside its own sheet when no studio frame hosts it', () => {
    stubColumnWidth(1600);
    const { container } = render(<InboxStudioLayout {...BASE_PROPS} drawer={<p>record</p>} />);

    expect(container.querySelector('[data-container="page"]')?.hasAttribute('data-sheet')).toBe(
      false,
    );
  });
});
