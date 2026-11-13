// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PendingAttachment } from '../pendingAttachment';
import { PendingAttachmentChip } from './PendingAttachmentChip';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const BLOB_URL = 'blob:app://localhost/checkout-502';

const picture: PendingAttachment = {
  id: 'att-1',
  fileName: 'checkout-502.png',
  mimeType: 'image/png',
  blob: new Blob([new Uint8Array(3)], { type: 'image/png' }),
  relPath: null,
};

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue(BLOB_URL);
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const page: PendingAttachment = {
  id: 'att-2',
  fileName: 'Checkout.md',
  mimeType: 'text/markdown',
  blob: new Blob(['Order total 12.00'], { type: 'text/markdown' }),
  relPath: null,
  source: {
    kind: 'page',
    title: 'Checkout',
    host: 'localhost:5173',
    url: 'http://localhost:5173/checkout',
    wordCount: 1_240,
    readAt: Date.now(),
    iconSrc: null,
  },
};

describe('PendingAttachmentChip', () => {
  it('shows a page with its title, host and word count, and removes it by title', () => {
    const onRemove = vi.fn();
    render(<PendingAttachmentChip attachment={page} onRemove={onRemove} />);

    expect(screen.getByText('Checkout').textContent).toBe('Checkout');
    expect(screen.getByText('localhost:5173 · 1.2k words').textContent).toContain('1.2k words');
    expect(screen.queryByText('Checkout.md')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Checkout' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('shows the pasted image as a thumbnail from its blob url', async () => {
    render(<PendingAttachmentChip attachment={picture} />);
    const image = await screen.findByAltText('checkout-502.png');
    expect(image.getAttribute('src')).toBe(BLOB_URL);
  });
});
