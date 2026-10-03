// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AttachmentChip, pendingAttachmentProps } from '.';
import type { PendingAttachment } from '../../pendingAttachment';

afterEach(cleanup);

const doc: PendingAttachment = {
  id: 'att-1',
  fileName: 'notes.txt',
  mimeType: 'text/plain',
  blob: new Blob(['hello'], { type: 'text/plain' }),
  relPath: null,
};

const picture: PendingAttachment = {
  id: 'att-2',
  fileName: 'board.png',
  mimeType: 'image/png',
  blob: new Blob([new Uint8Array(3)], { type: 'image/png' }),
  relPath: null,
};

describe('AttachmentChip', () => {
  it('reveals the remove control on keyboard focus, not only on hover', () => {
    render(
      <AttachmentChip
        {...pendingAttachmentProps({ attachment: doc, url: null })}
        onRemove={() => {}}
      />,
    );
    const remove = screen.getByRole('button', { name: 'Remove notes.txt' });

    expect(remove.className).toContain('opacity-0');
    expect(remove.className).toContain('focus-visible:opacity-100');
    expect(remove.className).toContain('group-hover:opacity-100');
  });

  it('opens the lightbox on an image thumbnail', () => {
    render(
      <AttachmentChip {...pendingAttachmentProps({ attachment: picture, url: 'blob:board' })} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview board.png' }));

    expect(screen.getByRole('dialog', { name: 'Preview board.png' })).toBeDefined();
  });

  it('leaves plain files without a preview affordance', () => {
    render(<AttachmentChip {...pendingAttachmentProps({ attachment: doc, url: null })} />);

    expect(screen.queryByRole('button', { name: 'Preview notes.txt' })).toBeNull();
    expect(screen.getByText('notes.txt')).toBeDefined();
  });

  it('shows a placeholder while a thumbnail is still loading', () => {
    const { container } = render(
      <AttachmentChip
        fileName="board.png"
        mimeType="image/png"
        thumbnail={{ status: 'loading' }}
      />,
    );

    expect(container.querySelector('img')).toBeNull();
  });
});
