// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteComposer } from './index';

afterEach(cleanup);

const field = () => screen.getByRole('textbox', { name: 'Write a comment' }) as HTMLTextAreaElement;

describe('NoteComposer', () => {
  it('submits the trimmed draft and clears the field', async () => {
    const onSubmit = vi.fn(async () => {});
    render(
      <NoteComposer placeholder="Write a comment" submitLabel="Comment" onSubmit={onSubmit} />,
    );

    fireEvent.change(field(), { target: { value: '  ships it  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('ships it'));
    await waitFor(() => expect(field().value).toBe(''));
  });

  it('keeps the draft and shows the failure when the post is rejected', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('Comment body is not valid!');
    });
    render(
      <NoteComposer placeholder="Write a comment" submitLabel="Comment" onSubmit={onSubmit} />,
    );

    fireEvent.change(field(), { target: { value: 'ships it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Comment body is not valid!');
    expect(field().value).toBe('ships it');
  });
});
