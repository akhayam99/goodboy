// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { splitStripImages } from './stripLayout';
import { AttachmentStrip, type AttachmentStripItem } from '.';

const { readAttachment } = vi.hoisted(() => ({
  readAttachment: vi.fn(async () => 'data:image/png;base64,AAAA'),
}));

vi.mock('../../../chat/turn', () => ({ readAttachment }));

beforeEach(() => {
  readAttachment.mockClear();
});

afterEach(cleanup);

type ImagesParams = {
  readonly count: number;
};

const imagesOf = ({ count }: ImagesParams): ReadonlyArray<AttachmentStripItem> =>
  Array.from({ length: count }, (_, index) => ({
    id: `img-${index + 1}`,
    fileName: `checkout-${index + 1}.png`,
    mimeType: 'image/png',
    kind: 'image',
    relPath: `attachments/checkout-${index + 1}.png`,
    workingDir: '/worktrees/payments-api',
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

const mount = ({ items }: { readonly items: ReadonlyArray<AttachmentStripItem> }) =>
  render(<AttachmentStrip items={items} railLabel="Images in this message" />);

describe('AttachmentStrip', () => {
  it('shows each image as a thumbnail button and keeps the other file as its chip', async () => {
    mount({ items: [...imagesOf({ count: 5 }), NOTES] });

    const thumbs = await screen.findAllByRole('button', { name: /^Preview checkout-/ });
    expect(thumbs.map((thumb) => thumb.getAttribute('aria-label'))).toEqual([
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

    const { shown, hidden } = splitStripImages({ count: 9 });
    const more = await screen.findByRole('button', { name: `Show ${hidden} more images` });
    expect(more.textContent).toBe(`+${hidden}`);
    expect(screen.getAllByRole('button', { name: /^Preview checkout-/ })).toHaveLength(shown);
    expect(readAttachment).toHaveBeenCalledTimes(shown);

    await user.click(more);

    expect(shownName()).toBe(`checkout-${shown + 1}.png`);
    await waitFor(() => expect(readAttachment).toHaveBeenCalledTimes(9));
    expect(screen.getAllByRole('button', { name: /, image \d+ of 9$/, hidden: true })).toHaveLength(
      9,
    );
  });

  it('shows a quiet placeholder for an image that cannot be read, not a broken image', async () => {
    readAttachment.mockRejectedValueOnce(new Error('gone'));
    mount({ items: imagesOf({ count: 2 }) });

    await screen.findByRole('img', { name: 'checkout-1.png, not available' });
    expect(screen.queryByRole('button', { name: 'Preview checkout-1.png' })).toBeNull();
    expect(
      screen
        .getAllByRole('button', { name: /^Preview checkout-/ })
        .map((thumb) => thumb.getAttribute('aria-label')),
    ).toEqual(['Preview checkout-2.png']);
  });

  it('shows the placeholder when the image has no folder to be read from', async () => {
    mount({ items: imagesOf({ count: 1 }).map((item) => ({ ...item, workingDir: null })) });

    await screen.findByRole('img', { name: 'checkout-1.png, not available' });
    expect(readAttachment).not.toHaveBeenCalled();
  });

  it('opens the viewer on the thumbnail, moves with the keys, and Escape gives focus back to it', async () => {
    const user = userEvent.setup();
    mount({ items: imagesOf({ count: 4 }) });

    const second = await screen.findByRole('button', { name: 'Preview checkout-2.png' });
    await user.click(second);
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
});
