// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RawDocumentEditor } from './index';

afterEach(cleanup);

type Saved = (isSaved: boolean) => void;

const deferredWrite = () => {
  const finishes: Array<Saved> = [];
  const onWrite = vi.fn(
    (_next: string) =>
      new Promise<boolean>((resolve) => {
        finishes.push(resolve);
      }),
  );
  return { onWrite, finish: (isSaved: boolean) => finishes[0]?.(isSaved) };
};

const editAndCommit = () => {
  const box = screen.getByRole('textbox', { name: 'Session summary source' });
  fireEvent.change(box, { target: { value: 'next draft' } });
  fireEvent.keyDown(box, { key: 'Enter', metaKey: true });
};

describe('RawDocumentEditor', () => {
  it('closes itself once the save lands', async () => {
    const { onWrite, finish } = deferredWrite();
    const onClose = vi.fn();
    render(
      <RawDocumentEditor
        value="draft"
        label="Session summary source"
        onWrite={onWrite}
        onClose={onClose}
      />,
    );

    editAndCommit();
    expect(onWrite).toHaveBeenCalledWith('next draft');
    await act(async () => {
      finish(true);
      await Promise.resolve();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves the close alone when another editor took its place during the save', async () => {
    const { onWrite, finish } = deferredWrite();
    const onClose = vi.fn();
    const { unmount } = render(
      <RawDocumentEditor
        value="draft"
        label="Session summary source"
        onWrite={onWrite}
        onClose={onClose}
      />,
    );

    editAndCommit();
    unmount();
    await act(async () => {
      finish(true);
      await Promise.resolve();
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
