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
    leftSidebar={<div>sessions</div>}
    main={<div>board</div>}
    studioCoversLeft={false}
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

  it('opens the item in the reader pane beside the page container, never inside it', () => {
    stubColumnWidth(1600);
    const { container } = render(shell({ drawer: 'record' }));
    const slot = container.querySelector<HTMLElement>('[data-studio-slot="content"]');
    const page = slot?.querySelector<HTMLElement>('[data-container="page"]');
    const drawer = slot?.querySelector<HTMLElement>('[data-container="drawer"]');

    expect(
      screen.getByRole('complementary', { name: 'Task' }).getAttribute('data-drawer-mode'),
    ).toBe('push');
    expect(drawer?.textContent).toContain('record');
    expect(page?.contains(drawer ?? null)).toBe(false);
  });

  it('sizes the pane on the reader tier and saves its width there, not on the side tier', () => {
    stubColumnWidth(1600);
    render(shell({ drawer: 'record' }));

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize the task pane' }), {
      key: 'ArrowLeft',
    });

    expect(localStorage.getItem(READER_DRAWER_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBeNull();
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
