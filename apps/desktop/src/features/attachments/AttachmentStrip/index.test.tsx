// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);

import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { storySpies, stubStoryInvoke } from '../../../store/storyHarness';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../test/fakeResizeObserver';
import { splitStripImages } from './stripLayout';
import { AttachmentStrip, type AttachmentStripItem } from '.';

const readAttachment = vi.fn(async (_args: unknown) => 'data:image/png;base64,AAAA');

let resize: FakeResizeObservers;
let stripWidth = 0;

beforeEach(() => {
  readAttachment.mockClear();
  storySpies.tauriInvoke.mockClear();
  stubStoryInvoke({ attachment_read: readAttachment });
  resize = installFakeResizeObserver();
  stripWidth = 0;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() =>
    DOMRect.fromRect({ width: stripWidth, height: 0 }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.style.overflow = '';
});

type ImagesParams = {
  readonly count: number;
  readonly isRemovable?: boolean;
};

const imagesOf = ({
  count,
  isRemovable = false,
}: ImagesParams): ReadonlyArray<AttachmentStripItem> =>
  Array.from({ length: count }, (_, index) => ({
    id: `img-${index + 1}`,
    fileName: `checkout-${index + 1}.png`,
    mimeType: 'image/png',
    kind: 'image',
    relPath: `attachments/checkout-${index + 1}.png`,
    workingDir: '/worktrees/payments-api',
    ...(isRemovable ? { onRemove: vi.fn() } : {}),
  }));

const shownName = (): string | null =>
  screen.getByRole('heading', { level: 2, hidden: true }).textContent;

const NOTES: AttachmentStripItem = {
  id: 'file-1',
  fileName: 'ledger-notes.txt',
  mimeType: 'text/plain',
  kind: 'file',
  relPath: 'attachments/ledger-notes.txt',
  workingDir: '/worktrees/payments-api',
};

type MountParams = {
  readonly items: ReadonlyArray<AttachmentStripItem>;
  readonly width?: number;
  readonly viewer?: ComponentProps<typeof AttachmentStrip>['viewer'];
};

const stripOf = ({ items, viewer }: Pick<MountParams, 'items' | 'viewer'>) => (
  <AttachmentStrip
    items={items}
    railLabel="Images in this message"
    {...(viewer === undefined ? {} : { viewer })}
  />
);

const mount = ({ items, width = 0, viewer }: MountParams) => {
  stripWidth = width;
  const view = render(stripOf({ items, viewer }));
  act(() => resize.resizeAll());
  return view;
};

const thumbs = () => screen.queryAllByRole('button', { name: /^Preview checkout-/ });

describe('AttachmentStrip', () => {
  it('shows each image as a thumbnail button and keeps the other file as its chip', async () => {
    mount({ items: [...imagesOf({ count: 5 }), NOTES] });

    const shown = await screen.findAllByRole('button', { name: /^Preview checkout-/ });
    expect(shown.map((thumb) => thumb.getAttribute('aria-label'))).toEqual([
      'Preview checkout-1.png',
      'Preview checkout-2.png',
      'Preview checkout-3.png',
      'Preview checkout-4.png',
      'Preview checkout-5.png',
    ]);
    screen.getByText('ledger-notes.txt');
    expect(screen.queryByRole('button', { name: /^Show \d+ more/ })).toBeNull();
    await waitFor(() => expect(document.querySelectorAll('img')).toHaveLength(5));
  });

  it('folds the rest behind +N, reads only the shown row, and counts from the same split', async () => {
    const user = userEvent.setup();
    mount({ items: imagesOf({ count: 9 }) });

    const { shown, hidden } = splitStripImages({ count: 9, width: null, canFold: true });
    const more = await screen.findByRole('button', { name: `Show ${hidden} more images` });
    expect(more.textContent).toBe(`+${hidden}`);
    expect(thumbs()).toHaveLength(shown);
    expect(readAttachment).toHaveBeenCalledTimes(shown);

    await user.click(more);

    expect(shownName()).toBe(`checkout-${shown + 1}.png`);
    await waitFor(() => expect(readAttachment).toHaveBeenCalledTimes(9));
    expect(screen.getAllByRole('button', { name: /, image \d+ of 9$/, hidden: true })).toHaveLength(
      9,
    );
  });

  it.each([
    { surface: 'the right drawer at its minimum', width: 352 },
    { surface: 'a message bubble in that drawer', width: 278 },
    { surface: 'a very narrow pane', width: 130 },
  ])('fits the visible tiles and +N inside $surface ($width px)', async ({ width }) => {
    mount({ items: imagesOf({ count: 9 }), width });

    const { shown, hidden } = splitStripImages({ count: 9, width, canFold: true });
    await screen.findByRole('button', { name: `Show ${hidden} more images` });
    expect(thumbs()).toHaveLength(shown);
    const tiles = shown + 1;
    expect(tiles * 48 + (tiles - 1) * 8).toBeLessThanOrEqual(width);
  });

  it('shows more tiles when the strip grows and folds again when it shrinks', async () => {
    mount({ items: imagesOf({ count: 9 }), width: 278 });
    await screen.findByRole('button', { name: /^Show \d+ more images$/ });
    expect(thumbs()).toHaveLength(4);

    stripWidth = 600;
    act(() => resize.resizeAll());
    await waitFor(() => expect(thumbs()).toHaveLength(9));
    expect(screen.queryByRole('button', { name: /^Show \d+ more/ })).toBeNull();

    stripWidth = 352;
    act(() => resize.resizeAll());
    await waitFor(() => expect(thumbs()).toHaveLength(5));
    screen.getByRole('button', { name: 'Show 4 more images' });
  });

  it('shows a quiet placeholder for an image that cannot be read, not a broken image', async () => {
    readAttachment.mockRejectedValueOnce(new Error('gone'));
    mount({ items: imagesOf({ count: 2 }) });

    await screen.findByRole('button', { name: 'checkout-1.png, not available' });
    expect(screen.queryByRole('button', { name: 'Preview checkout-1.png' })).toBeNull();
    expect(document.querySelectorAll('img')).toHaveLength(1);
  });

  it('shows the placeholder when the image has no folder to be read from', async () => {
    mount({ items: imagesOf({ count: 1 }).map((item) => ({ ...item, workingDir: null })) });

    await screen.findByRole('button', { name: 'checkout-1.png, not available' });
    expect(readAttachment).not.toHaveBeenCalled();
  });

  it('keeps the same opener when a read fails, so Escape gives focus back to it', async () => {
    const user = userEvent.setup();
    let reject: (error: Error) => void = () => undefined;
    readAttachment.mockImplementationOnce(
      () =>
        new Promise<string>((_resolve, fail) => {
          reject = fail;
        }),
    );
    mount({ items: imagesOf({ count: 2 }) });
    const opener = screen.getByRole('button', { name: 'Preview checkout-1.png' });

    await act(async () => {
      reject(new Error('gone'));
      await Promise.resolve();
    });
    const failed = await screen.findByRole('button', { name: 'checkout-1.png, not available' });
    expect(failed).toBe(opener);
    fireEvent.click(failed);
    screen.getByText('Image not available');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    expect(document.activeElement).toBe(failed);
  });

  it('opens the viewer on the thumbnail, moves with the keys, and Escape gives focus back to it', async () => {
    const user = userEvent.setup();
    mount({ items: imagesOf({ count: 4 }) });

    const second = await screen.findByRole('button', { name: 'Preview checkout-2.png' });
    expect(document.activeElement).not.toBe(second);
    fireEvent.click(second);
    expect(shownName()).toBe('checkout-2.png');

    await user.keyboard('{ArrowDown}');
    expect(shownName()).toBe('checkout-3.png');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    expect(document.activeElement).toBe(second);
  });

  it('moves in the viewer by rail click and wraps from the last image to the first', async () => {
    const user = userEvent.setup();
    mount({ items: imagesOf({ count: 3 }) });

    await user.click(await screen.findByRole('button', { name: 'Preview checkout-3.png' }));
    await user.keyboard('{ArrowDown}');

    expect(shownName()).toBe('checkout-1.png');
    await user.click(
      screen.getByRole('button', { name: 'checkout-2.png, image 2 of 3', hidden: true }),
    );
    expect(shownName()).toBe('checkout-2.png');
  });

  it('closes the viewer and frees the page when the open image is removed, and stays closed', async () => {
    const items = imagesOf({ count: 3 });
    const view = mount({ items });
    fireEvent.click(await screen.findByRole('button', { name: 'Preview checkout-2.png' }));
    expect(document.body.style.overflow).toBe('hidden');

    view.rerender(stripOf({ items: items.filter(({ id }) => id !== 'img-2') }));

    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());
    expect(document.body.style.overflow).toBe('');
    view.rerender(stripOf({ items }));
    await screen.findByRole('button', { name: 'Preview checkout-2.png' });
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the viewer and frees the page when every image is removed', async () => {
    const items = imagesOf({ count: 2 });
    const view = mount({ items });
    fireEvent.click(await screen.findByRole('button', { name: 'Preview checkout-1.png' }));

    view.rerender(stripOf({ items: [NOTES] }));

    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());
    expect(document.body.style.overflow).toBe('');
    view.rerender(stripOf({ items: [...items, NOTES] }));
    await screen.findByRole('button', { name: 'Preview checkout-1.png' });
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });

  it('releases the images only the viewer needed once it closes', async () => {
    const user = userEvent.setup();
    mount({ items: imagesOf({ count: 9 }) });
    const { hidden } = splitStripImages({ count: 9, width: null, canFold: true });
    const more = await screen.findByRole('button', { name: `Show ${hidden} more images` });
    await user.click(more);
    await waitFor(() => expect(readAttachment).toHaveBeenCalledTimes(9));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull());

    await user.click(screen.getByRole('button', { name: `Show ${hidden} more images` }));

    await waitFor(() => expect(readAttachment).toHaveBeenCalledTimes(9 + hidden));
  });

  it('never folds images that can be removed, so every one keeps its Remove control', async () => {
    const items = imagesOf({ count: 9, isRemovable: true });
    mount({ items, width: 352 });

    await screen.findAllByRole('button', { name: /^Preview checkout-/ });
    expect(thumbs()).toHaveLength(9);
    expect(screen.queryByRole('button', { name: /^Show \d+ more/ })).toBeNull();
    const removes = screen.getAllByRole('button', { name: /^Remove checkout-/ });
    expect(removes).toHaveLength(9);
    fireEvent.click(screen.getByRole('button', { name: 'Remove checkout-9.png' }));
    expect(items[8]?.onRemove).toHaveBeenCalledOnce();
  });

  it('keeps the open image in a controlled viewer and follows the image shown', async () => {
    const onOpenChange = vi.fn();
    const items = imagesOf({ count: 3 });
    const view = mount({ items, viewer: { openId: 'img-2', onOpenChange } });

    expect(shownName()).toBe('checkout-2.png');
    await userEvent.setup().keyboard('{ArrowDown}');
    expect(onOpenChange).toHaveBeenLastCalledWith({ openId: 'img-3' });

    view.unmount();
    const again = render(stripOf({ items, viewer: { openId: 'img-3', onOpenChange } }));
    expect(shownName()).toBe('checkout-3.png');
    expect(
      within(again.container).getAllByRole('button', { name: /^Preview checkout-/ }),
    ).toHaveLength(3);
  });
});
