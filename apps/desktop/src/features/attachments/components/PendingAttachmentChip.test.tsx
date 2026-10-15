// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PendingAttachment } from '../pendingAttachment';
import { PendingAttachmentChip } from './PendingAttachmentChip';

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

describe('PendingAttachmentChip', () => {
  it('shows the pasted image as a thumbnail from its blob url', async () => {
    render(<PendingAttachmentChip attachment={picture} />);
    const image = await screen.findByAltText('checkout-502.png');
    expect(image.getAttribute('src')).toBe(BLOB_URL);
  });
});
