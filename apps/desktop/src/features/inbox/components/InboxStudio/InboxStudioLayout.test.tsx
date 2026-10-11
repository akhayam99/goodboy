import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppShell, DRAWER_INSET, RIGHT_DRAWER_MAX, RIGHT_DRAWER_STORAGE_KEY } from '@goodboy/ui';
import { StudioFrame } from '../../../../app/components/StudioFrame';
import { InboxStudioLayout } from './InboxStudioLayout';

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
          <InboxStudioLayout list={<p>rows</p>} drawer={drawer === null ? null : <p>{drawer}</p>} />
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

describe('InboxStudioLayout', () => {
  it('keeps the drawer column closed while nothing is open, with no filters column beside the list', () => {
    render(<InboxStudioLayout list={<p>rows</p>} drawer={null} />);

    const drawer = screen.getByRole('complementary', { name: 'Task' });
    expect(drawer.getAttribute('data-drawer-mode')).toBe('closed');
    expect(drawer.style.width).toBe('0px');
    expect(screen.queryByRole('complementary', { name: 'Task filters' })).toBeNull();
  });

  it('opens the record in a drawer at the one saved width, clamped', () => {
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, '900');

    render(<InboxStudioLayout list={<p>rows</p>} drawer={<p>record</p>} />);

    const drawer = screen.getByRole('complementary', { name: 'Task' });
    expect(drawer.style.width).toBe(`${RIGHT_DRAWER_MAX + DRAWER_INSET * 2}px`);
    expect(drawer.getAttribute('data-drawer-mode')).toBe('push');
  });

  it('saves the width the drawer is resized to', () => {
    render(<InboxStudioLayout list={<p>rows</p>} drawer={<p>record</p>} />);

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
            <InboxStudioLayout list={<p>rows</p>} drawer={null} />
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
    const { container } = render(<InboxStudioLayout list={<p>rows</p>} drawer={<p>record</p>} />);

    expect(container.querySelector('[data-container="page"]')?.hasAttribute('data-sheet')).toBe(
      false,
    );
  });
});
