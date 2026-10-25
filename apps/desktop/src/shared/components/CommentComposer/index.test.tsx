// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CommentComposer, type CommentComposerBody } from '.';

afterEach(cleanup);

type HarnessProps = {
  readonly onSubmit?: (params: CommentComposerBody) => void | Promise<void>;
  readonly onCancel?: () => void;
  readonly onAskAgent?: (params: CommentComposerBody) => void;
  readonly isEmptyAllowed?: boolean;
  readonly error?: string | null;
  readonly initial?: string;
};

const Harness = ({
  onSubmit = () => undefined,
  onCancel = () => undefined,
  onAskAgent,
  isEmptyAllowed = false,
  error = null,
  initial = '',
}: HarnessProps) => {
  const [value, setValue] = useState(initial);
  return (
    <CommentComposer
      label="Reply to Harborline"
      submitLabel="Reply"
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      onCancel={onCancel}
      onAskAgent={onAskAgent}
      isEmptyAllowed={isEmptyAllowed}
      error={error}
    />
  );
};

const field = () => screen.getByRole('textbox', { name: 'Reply to Harborline' });

const submitChord = () => fireEvent.keyDown(field(), { key: 'Enter', metaKey: true });

const escape = () => fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

describe('CommentComposer', () => {
  it('submits an object with the trimmed body, from the key and from the button', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.change(field(), { target: { value: '  Take the transaction.  ' } });

    submitChord();
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

    expect(onSubmit).toHaveBeenNthCalledWith(1, { body: 'Take the transaction.' });
    expect(onSubmit).toHaveBeenNthCalledWith(2, { body: 'Take the transaction.' });
  });

  it('sends nothing for a blank body unless an empty one is allowed', () => {
    const onSubmit = vi.fn();
    const view = render(<Harness onSubmit={onSubmit} />);

    submitChord();
    expect(screen.getByRole('button', { name: 'Reply' }).hasAttribute('disabled')).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();

    view.rerender(<Harness onSubmit={onSubmit} isEmptyAllowed />);
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(onSubmit).toHaveBeenCalledWith({ body: '' });
  });

  it('holds the buttons while an async submit runs, then frees them', async () => {
    let finish: () => void = () => undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<Harness onSubmit={onSubmit} initial="Reuse the caller transaction." />);

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Reply' }).hasAttribute('disabled')).toBe(true);

    await act(async () => {
      finish();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Reply' }).hasAttribute('disabled')).toBe(false);
  });

  it('shows the error in an alert and keeps the text', () => {
    render(<Harness error="Could not reach the host" initial="Keep me" />);

    expect(screen.getByRole('alert').textContent).toBe('Could not reach the host');
    expect(field()).toHaveProperty('value', 'Keep me');
  });

  it('hands the trimmed body to Ask agent', () => {
    const onAskAgent = vi.fn();
    render(<Harness onAskAgent={onAskAgent} initial="  Why a second credit?  " />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask agent' }));

    expect(onAskAgent).toHaveBeenCalledWith({ body: 'Why a second credit?' });
  });

  it('shows no Ask agent button without a handler', () => {
    render(<Harness />);

    expect(screen.queryByRole('button', { name: 'Ask agent' })).toBeNull();
  });

  it('cancels on the Cancel button', () => {
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});

type LayerProps = {
  readonly onDismiss: () => void;
  readonly onCancel: () => void;
  readonly isComposing: boolean;
};

const Layered = ({ onDismiss, onCancel, isComposing }: LayerProps) => {
  useEscapeLayer(onDismiss);
  return isComposing ? <Harness onCancel={onCancel} /> : null;
};

describe('CommentComposer on the escape stack', () => {
  it('lets Esc close only the composer above a drawer, then the drawer', () => {
    const onDismiss = vi.fn();
    const onCancel = vi.fn();
    const view = render(<Layered onDismiss={onDismiss} onCancel={onCancel} isComposing={false} />);
    view.rerender(<Layered onDismiss={onDismiss} onCancel={onCancel} isComposing />);

    escape();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();

    view.rerender(<Layered onDismiss={onDismiss} onCancel={onCancel} isComposing={false} />);
    escape();
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('cancels from a keystroke in the field too', () => {
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);

    fireEvent.keyDown(field(), { key: 'Escape', code: 'Escape' });

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
