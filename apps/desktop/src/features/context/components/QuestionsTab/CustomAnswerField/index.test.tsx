// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { CustomAnswerField } from '.';

afterEach(cleanup);

type FieldProps = ComponentProps<typeof CustomAnswerField>;

const renderField = (patch: Partial<FieldProps> = {}) => {
  const props: FieldProps = {
    value: '',
    open: false,
    mode: 'one',
    onToggle: vi.fn(),
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onEscape: vi.fn(),
    ...patch,
  };
  render(<CustomAnswerField {...props} />);
  return props;
};

describe('CustomAnswerField', () => {
  it('reads as the Something else tile while closed', () => {
    const props = renderField();
    screen.getByText('Write your own answer');
    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }));
    expect(props.onToggle).toHaveBeenCalledOnce();
  });

  it('writes into the inline field once open', () => {
    const props = renderField({ open: true });
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), {
      target: { value: 'neither' },
    });
    expect(props.onChange).toHaveBeenCalledWith('neither');
  });

  it('submits on Enter and keeps Shift Enter for a new line', () => {
    const props = renderField({ open: true, value: 'neither' });
    const field = screen.getByRole('textbox', { name: 'Your answer' });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(props.onSubmit).toHaveBeenCalledOnce();
  });

  it('hands focus back on Escape', () => {
    const props = renderField({ open: true });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Your answer' }), { key: 'Escape' });
    expect(props.onEscape).toHaveBeenCalledOnce();
  });

  it('uses a checkbox in multi-choice mode', () => {
    renderField({ mode: 'many' });
    screen.getByRole('checkbox', { name: 'Something else' });
  });
});
