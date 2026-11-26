// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DrawerColumn } from '../components/DrawerColumn';
import { DrawerFrame } from '../components/DrawerFrame';
import { dismissTopEscapeLayer } from '../escape';
import { PANE_RHYTHM } from '../paneRhythm';

afterEach(cleanup);

const Harness = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        3 drafts
      </button>
      {isOpen ? (
        <DrawerFrame title="Drafts" count={3} onClose={() => setIsOpen(false)}>
          <p>payout.ts:13</p>
        </DrawerFrame>
      ) : null}
    </div>
  );
};

describe('DrawerFrame', () => {
  it('names the panel and shows its title, count, and body', () => {
    render(
      <DrawerFrame title="Drafts" count={3} onClose={vi.fn()}>
        <p>payout.ts:13</p>
      </DrawerFrame>,
    );

    expect(screen.getByRole('region', { name: 'Drafts' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Drafts' })).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('payout.ts:13')).toBeDefined();
  });

  it('draws one header with no divider under it, a meta line and the verb, menu, close order', () => {
    const { container } = render(
      <DrawerFrame
        title="ledger-export.ts"
        meta="src/exports · 4 KB"
        action={<button type="button">Open in editor</button>}
        menu={<button type="button">More</button>}
        onClose={vi.fn()}
      >
        <p>export const run = () =&gt; undefined;</p>
      </DrawerFrame>,
    );

    expect(container.querySelector('[role="separator"], hr')).toBeNull();
    expect(screen.getByText('src/exports · 4 KB').hasAttribute('data-drawer-meta')).toBe(true);
    expect(screen.getByRole('heading', { name: 'ledger-export.ts' }).className.split(' ')).toEqual(
      expect.arrayContaining(['min-w-0', 'truncate']),
    );
    const verb = screen.getByRole('button', { name: 'Open in editor' });
    const menu = screen.getByRole('button', { name: 'More' });
    const close = screen.getByRole('button', { name: 'Close' });
    expect(verb.compareDocumentPosition(menu)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(menu.compareDocumentPosition(close)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('draws no header of its own when the body brings one and still closes with Escape', () => {
    const onClose = vi.fn();
    const { container } = render(
      <DrawerFrame title="Explore" isHeaderless onClose={onClose}>
        <h1>Explore</h1>
      </DrawerFrame>,
    );

    expect(container.querySelector('[data-drawer-header]')).toBeNull();
    expect(screen.getByRole('region', { name: 'Explore' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with Escape and with its close button', () => {
    const onClose = vi.fn();
    render(
      <DrawerFrame title="Drafts" onClose={onClose}>
        <p>payout.ts:13</p>
      </DrawerFrame>,
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('hands focus back to the trigger once it closes', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: '3 drafts' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('region', { name: 'Drafts' })).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('region', { name: 'Drafts' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('names its close button Close whatever the drawer holds', () => {
    render(
      <DrawerFrame
        title="Drafts"
        back={{ label: 'Back to Ask', onBack: vi.fn() }}
        onClose={vi.fn()}
      >
        <p>body</p>
      </DrawerFrame>,
    );

    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
  });

  it('closes with the X and steps back with the arrow and with Escape', () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    render(
      <DrawerFrame title="Drafts" back={{ label: 'Back to Ask', onBack }} onClose={onClose}>
        <p>body</p>
      </DrawerFrame>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to Ask' }));
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('makes the close button a 28px target', () => {
    render(
      <DrawerFrame title="Drafts" onClose={vi.fn()}>
        <p>body</p>
      </DrawerFrame>,
    );

    expect(screen.getByRole('button', { name: 'Close' }).className).toContain('size-7');
  });

  it('lets a body that scrolls itself fill the frame instead of nesting a scroller', () => {
    render(
      <DrawerFrame title="Chat" scroll="self" onClose={vi.fn()}>
        <p data-testid="chat-body">hello</p>
      </DrawerFrame>,
    );

    const body = screen.getByTestId('chat-body').parentElement;
    expect(body?.className).toContain('flex-1');
    expect(body?.className).toContain('min-h-0');
  });

  it('puts a toolbar on a second row under the title and the close button, stepping aside while you read', () => {
    const { container } = render(
      <DrawerFrame
        title="Retry-safe webhook credits"
        toolbar={<button type="button">Approve</button>}
        onClose={vi.fn()}
      >
        <p>body</p>
      </DrawerFrame>,
    );

    const header = screen.getByRole('banner');
    const toolbar = container.querySelector('[data-drawer-toolbar]');
    const stepAside = container.querySelector('[data-slot="reveal-header"]');
    expect(toolbar?.contains(screen.getByRole('button', { name: 'Approve' }))).toBe(true);
    expect(stepAside?.contains(toolbar ?? null)).toBe(true);
    expect(
      header.compareDocumentPosition(stepAside ?? header) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(toolbar?.contains(screen.getByRole('button', { name: 'Close' }))).toBe(false);
    expect(header.contains(screen.getByRole('button', { name: 'Close' }))).toBe(true);
    expect(
      header.contains(screen.getByRole('heading', { name: 'Retry-safe webhook credits' })),
    ).toBe(true);
  });

  it('has no toolbar row unless one is passed', () => {
    render(
      <DrawerFrame title="Drafts" onClose={vi.fn()}>
        <p>body</p>
      </DrawerFrame>,
    );

    expect(document.querySelector('[data-drawer-toolbar]')).toBeNull();
    expect(document.querySelector('[data-slot="reveal-region"]')).toBeNull();
  });

  it('focuses the drawer itself, not Close, when it opens and holds no field', () => {
    render(
      <DrawerFrame title="Drafts" onClose={vi.fn()}>
        <p>body</p>
      </DrawerFrame>,
    );

    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Drafts' }));
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('shows no Close tooltip when it opens', () => {
    render(
      <DrawerFrame title="Drafts" onClose={vi.fn()}>
        <p>body</p>
      </DrawerFrame>,
    );

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('still closes on Esc from the focused drawer', () => {
    const onClose = vi.fn();
    render(
      <DrawerFrame title="Drafts" onClose={onClose}>
        <p>body</p>
      </DrawerFrame>,
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('focuses the composer in its dock when it has one', () => {
    render(
      <DrawerFrame title="Chat" dock={<textarea aria-label="Reply" />} onClose={vi.fn()}>
        <p>body</p>
      </DrawerFrame>,
    );

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Reply' }));
  });

  it('leaves focus where the body put it itself', () => {
    const Own = () => <input aria-label="Name" autoFocus />;
    render(
      <DrawerFrame title="Edit" onClose={vi.fn()}>
        <Own />
      </DrawerFrame>,
    );

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' }));
  });

  it('hands focus back to the last focused control when a shortcut opened it from the page body', () => {
    const view = render(
      <div>
        <button type="button">Context</button>
      </div>,
    );
    const anchor = screen.getByRole('button', { name: 'Context' });
    anchor.focus();
    anchor.blur();
    expect(document.activeElement).toBe(document.body);

    view.rerender(
      <div>
        <button type="button">Context</button>
        <DrawerFrame title="Drafts" onClose={vi.fn()}>
          <p>body</p>
        </DrawerFrame>
      </div>,
    );
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Drafts' }));

    view.rerender(
      <div>
        <button type="button">Context</button>
      </div>,
    );
    expect(document.activeElement).toBe(anchor);
  });
});

type WidthParams = { readonly width: number };

type ObserverCallback = (
  entries: ReadonlyArray<{ readonly target: Element; readonly contentRect: { width: number } }>,
) => void;

const stubHeadWidth = ({ width }: WidthParams) => {
  class FixedResizeObserver {
    private readonly callback: ObserverCallback;

    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback([{ target, contentRect: { width } }]);
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }
  vi.stubGlobal('ResizeObserver', FixedResizeObserver);
};

const PageFrame = () => (
  <DrawerFrame
    title="Monitor for payments-api"
    page={{ label: 'Open full page', onOpen: vi.fn() }}
    onClose={vi.fn()}
  >
    <p>body</p>
  </DrawerFrame>
);

describe('DrawerFrame at a narrow width', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the full page key in the head while it is wide', () => {
    stubHeadWidth({ width: 520 });
    render(<PageFrame />);

    screen.getByRole('button', { name: 'Open full page' });
    expect(document.querySelector('[data-head-folded]')).toBeNull();
  });

  it('folds the head at a narrow width and keeps the title, the full page key and Close', () => {
    stubHeadWidth({ width: 280 });
    render(<PageFrame />);

    expect(document.querySelector('[data-head-folded]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Monitor for payments-api' }).className).toContain(
      'truncate',
    );
    screen.getByRole('button', { name: 'Open full page' });
    screen.getByRole('button', { name: 'Close' });
    expect(screen.queryByRole('button', { name: /^More on / })).toBeNull();
  });
});
