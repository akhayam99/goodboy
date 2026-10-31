// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { registerEscapeLayer } from '@goodboy/ui';
import { ImageLightbox } from './index';
import type { ImageLightboxItem } from './types';

afterEach(cleanup);

describe('ImageLightbox', () => {
  it('renders the dialog named after the image, with the image', () => {
    render(<ImageLightbox src="img.png" alt="screenshot" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'screenshot', hidden: true })).toBeDefined();
    expect(screen.getByAltText('screenshot')).toBeDefined();
  });

  it('closes when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="img.png" alt="x" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close image preview/i, hidden: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close when the image itself is clicked', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="img.png" alt="x" onClose={onClose} />);
    fireEvent.click(screen.getByAltText('x'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the empty area around the image is clicked', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="img.png" alt="x" onClose={onClose} />);
    const area = screen.getByAltText('x').parentElement;
    if (area === null) {
      throw new Error('image has no parent');
    }
    fireEvent.click(area);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape, and leaves it to a layer opened above it', () => {
    const onClose = vi.fn();
    const closeAbove = vi.fn();
    render(<ImageLightbox src="img.png" alt="x" onClose={onClose} />);
    const offAbove = registerEscapeLayer(closeAbove);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(closeAbove).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    offAbove();
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('opens as a modal dialog', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(<ImageLightbox src="img.png" alt="Harborline ledger export" onClose={vi.fn()} />);
    expect(showModal).toHaveBeenCalledOnce();
    showModal.mockRestore();
  });

  it('puts focus on Close when it opens and gives it back to the opener', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const view = render(
      <ImageLightbox src="img.png" alt="Harborline ledger export" onClose={vi.fn()} />,
    );
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /close image preview/i, hidden: true }),
    );

    view.unmount();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('frees the page scroll again once it unmounts', () => {
    const view = render(<ImageLightbox src="img.png" alt="x" onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');

    view.unmount();

    expect(document.body.style.overflow).toBe('');
  });

  it('shows an image through an img element and no frame', () => {
    const { baseElement } = render(<ImageLightbox src="img.png" alt="x" onClose={vi.fn()} />);
    expect(baseElement.querySelector('img')?.getAttribute('src')).toBe('img.png');
    expect(baseElement.querySelector('iframe')).toBeNull();
  });

  it('shows a pdf through an iframe with the given source and an empty sandbox', () => {
    const { baseElement } = render(
      <ImageLightbox src="about:blank" alt="Q3 report" media="pdf" onClose={vi.fn()} />,
    );
    const frame = baseElement.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe('about:blank');
    expect(frame?.getAttribute('title')).toBe('Q3 report');
    expect(frame?.getAttribute('sandbox')).toBe('');
    expect(baseElement.querySelector('img')).toBeNull();
  });
});

const FIRST: ImageLightboxItem = {
  id: 'a',
  alt: 'checkout-error.png',
  source: { status: 'ready', src: 'a.png' },
};
const SECOND: ImageLightboxItem = {
  id: 'b',
  alt: 'ledger-diff.png',
  source: { status: 'ready', src: 'b.png' },
};
const THIRD: ImageLightboxItem = {
  id: 'c',
  alt: 'retry-trace.png',
  source: { status: 'ready', src: 'c.png' },
};
const ITEMS: ReadonlyArray<ImageLightboxItem> = [FIRST, SECOND, THIRD];

type MountParams = {
  readonly items?: ReadonlyArray<ImageLightboxItem>;
  readonly startId?: string;
  readonly onClose?: () => void;
};

const mountSet = ({ items = ITEMS, startId = 'a', onClose = vi.fn() }: MountParams) =>
  render(
    <ImageLightbox
      items={items}
      startId={startId}
      railLabel="Images in this message"
      onClose={onClose}
    />,
  );

const shownName = (): string | null =>
  screen.getByRole('heading', { level: 2, hidden: true }).textContent;

describe('ImageLightbox with a rail of the other images', () => {
  it('names every rail item and marks the one shown', () => {
    mountSet({ startId: 'b' });
    const rail = screen.getByRole('list', { name: 'Images in this message', hidden: true });
    const buttons = within(rail).getAllByRole('button', { hidden: true });

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'checkout-error.png, image 1 of 3',
      'ledger-diff.png, image 2 of 3',
      'retry-trace.png, image 3 of 3',
    ]);
    expect(buttons.map((button) => button.getAttribute('aria-current'))).toEqual([
      null,
      'true',
      null,
    ]);
    expect(shownName()).toBe('ledger-diff.png');
    screen.getByText('2 of 3');
  });

  it('moves with the arrow keys in both directions and wraps at both ends', async () => {
    const user = userEvent.setup();
    mountSet({});

    await user.keyboard('{ArrowDown}');
    expect(shownName()).toBe('ledger-diff.png');
    await user.keyboard('{ArrowRight}');
    expect(shownName()).toBe('retry-trace.png');
    await user.keyboard('{ArrowDown}');
    expect(shownName()).toBe('checkout-error.png');
    await user.keyboard('{ArrowUp}');
    expect(shownName()).toBe('retry-trace.png');
    await user.keyboard('{ArrowLeft}');
    expect(shownName()).toBe('ledger-diff.png');
  });

  it('moves on a click on a rail item and keeps the arrows working from there', async () => {
    const user = userEvent.setup();
    mountSet({});

    await user.click(
      screen.getByRole('button', { name: 'retry-trace.png, image 3 of 3', hidden: true }),
    );
    expect(shownName()).toBe('retry-trace.png');
    expect(screen.getByAltText('retry-trace.png').getAttribute('src')).toBe('c.png');
    await user.keyboard('{ArrowUp}');
    expect(shownName()).toBe('ledger-diff.png');
  });

  it('closes on Escape after moving', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mountSet({ onClose });

    await user.keyboard('{ArrowDown}{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps the image shown when the list re-renders with its source loaded', async () => {
    const user = userEvent.setup();
    const view = mountSet({
      items: [FIRST, { ...SECOND, source: { status: 'loading' } }, THIRD],
    });
    await user.keyboard('{ArrowDown}');

    view.rerender(
      <ImageLightbox
        items={ITEMS}
        startId="a"
        railLabel="Images in this message"
        onClose={vi.fn()}
      />,
    );

    expect(shownName()).toBe('ledger-diff.png');
    expect(screen.getByAltText('ledger-diff.png').getAttribute('src')).toBe('b.png');
    await user.keyboard('{ArrowDown}');
    expect(shownName()).toBe('retry-trace.png');
  });

  it('shows a quiet placeholder for an image that failed, and the keys move past it', async () => {
    const user = userEvent.setup();
    const { baseElement } = mountSet({
      items: [FIRST, { ...SECOND, source: { status: 'failed' } }, THIRD],
    });

    await user.keyboard('{ArrowDown}');

    screen.getByRole('img', { name: "ledger-diff.png couldn't be loaded", hidden: true });
    screen.getByText('Image not available');
    expect(baseElement.querySelector('img[src="b.png"]')).toBeNull();
    await user.keyboard('{ArrowDown}');
    expect(shownName()).toBe('retry-trace.png');
  });

  it('shows no rail and ignores the arrows for one image', async () => {
    const user = userEvent.setup();
    mountSet({ items: [FIRST] });

    await user.keyboard('{ArrowDown}');

    expect(screen.queryByRole('list', { hidden: true })).toBeNull();
    expect(shownName()).toBe('checkout-error.png');
  });
});
