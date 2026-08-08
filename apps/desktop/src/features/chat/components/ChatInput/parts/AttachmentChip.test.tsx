// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AttachmentChip } from './AttachmentChip';
import type { PendingAttachment } from '../lib';

afterEach(cleanup);

const attachment: PendingAttachment = {
  id: 'att-1',
  fileName: 'notes.txt',
  mimeType: 'text/plain',
  dataUrl: 'data:text/plain;base64,aGVsbG8=',
  relPath: null,
};

describe('AttachmentChip', () => {
  it('reveals the remove control on keyboard focus, not only on hover', () => {
    render(<AttachmentChip attachment={attachment} onRemove={() => {}} />);
    const remove = screen.getByRole('button', { name: 'Remove notes.txt' });

    expect(remove.className).toContain('opacity-0');
    expect(remove.className).toContain('focus-visible:opacity-100');
    expect(remove.className).toContain('group-hover:opacity-100');
  });
});
