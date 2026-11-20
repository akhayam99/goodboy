import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppShell, READER_DRAWER_STORAGE_KEY, RIGHT_DRAWER_STORAGE_KEY } from '@goodboy/ui';
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

const shell = ({ drawer }: { readonly drawer: string | null }) => (
  <AppShell
    leftRail={<nav aria-label="Places" />}
    main={<div>board</div>}
    studio={
      <StudioFrame kind="inbox" placement="content" onClose={() => undefined}>
        <InboxStudioLayout main={<p>rows</p>} drawer={drawer === null ? null : <p>{drawer}</p>} />
      </StudioFrame>
    }
  />
);

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InboxStudioLayout', () => {
  it('has no filter rail: the list owns the page', () => {
    stubColumnWidth(1600);
    render(shell({ drawer: null }));

    expect(screen.queryByRole('complementary', { name: 'Task filters' })).toBeNull();
    expect(screen.getByText('rows')).toBeDefined();
  });

  it('opens the item in the detail panel beside the page container, never inside it', () => {
    stubColumnWidth(1600);
    const { container } = render(shell({ drawer: 'record' }));
    const slot = container.querySelector<HTMLElement>('[data-studio-slot="content"]');
    const page = slot?.querySelector<HTMLElement>('[data-container="page"]');
    const detail = slot?.querySelector<HTMLElement>('[data-container="detail"]');

    expect(
      screen.getByRole('complementary', { name: 'Task' }).getAttribute('data-drawer-mode'),
    ).toBe('push');
    expect(detail?.textContent).toContain('record');
    expect(page?.contains(detail ?? null)).toBe(false);
  });

  it('saves the task pane width under its own key, never under a shared tier key', () => {
    stubColumnWidth(1600);
    render(shell({ drawer: 'record' }));

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize the task pane' }), {
      key: 'ArrowLeft',
    });

    expect(localStorage.getItem('goodboy:detail-width:studio-inbox:v1')).not.toBeNull();
    expect(localStorage.getItem(READER_DRAWER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBeNull();
  });

  it('starts the task pane from the old reader width, and keeps its own once resized', () => {
    localStorage.setItem(READER_DRAWER_STORAGE_KEY, '600');
    stubColumnWidth(1600);
    const view = render(shell({ drawer: 'record' }));
    const separator = () => screen.getByRole('separator', { name: 'Resize the task pane' });

    expect(separator().getAttribute('aria-valuenow')).toBe('600');
    fireEvent.keyDown(separator(), { key: 'ArrowLeft' });
    const saved = localStorage.getItem('goodboy:detail-width:studio-inbox:v1');
    view.unmount();
    localStorage.setItem(READER_DRAWER_STORAGE_KEY, '900');
    render(shell({ drawer: 'record' }));

    expect(separator().getAttribute('aria-valuenow')).toBe(saved);
  });

  it('closes the pane when the item is deselected', () => {
    stubColumnWidth(1600);
    const view = render(shell({ drawer: 'record' }));

    view.rerender(shell({ drawer: null }));

    expect(
      screen.getByRole('complementary', { name: 'Task' }).getAttribute('data-drawer-mode'),
    ).toBe('closed');
  });

  it('keeps its own drawer column when no studio frame hosts it', () => {
    stubColumnWidth(1600);
    render(<InboxStudioLayout main={<p>rows</p>} drawer={<p>record</p>} />);

    expect(screen.getByRole('complementary', { name: 'Task' })).toBeDefined();
    expect(screen.getByText('record')).toBeDefined();
  });
});
