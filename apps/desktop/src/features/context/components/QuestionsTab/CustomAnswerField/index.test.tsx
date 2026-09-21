// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CustomAnswerField } from '.';

afterEach(cleanup);

describe('CustomAnswerField', () => {
  it('renders the open trigger when closed and fires onToggle', () => {
    const onToggle = vi.fn();
    render(
      <CustomAnswerField value="" open={false} onToggle={onToggle} onChange={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /other/i }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders a textarea when open and forwards typed value', () => {
    const onChange = vi.fn();
    render(<CustomAnswerField value="" open onToggle={() => undefined} onChange={onChange} />);
    const textarea = screen.getByPlaceholderText(/write your own answer/i);
    fireEvent.change(textarea, { target: { value: 'hi' } });
    expect(onChange).toHaveBeenCalledWith('hi');
  });

  it('closes as a full row in the option border language, never a dashed pill', () => {
    render(
      <CustomAnswerField
        value=""
        open={false}
        onToggle={() => undefined}
        onChange={() => undefined}
      />,
    );
    const trigger = screen.getByRole('button', { name: /other/i });

    expect(trigger.className).toContain('w-full');
    expect(trigger.className).not.toContain('border-dashed');
    expect(trigger.className).not.toContain('self-start');
  });

  it('reads as selected once it carries an answer', () => {
    const { container } = render(
      <CustomAnswerField
        value="use Neon"
        open
        onToggle={() => undefined}
        onChange={() => undefined}
      />,
    );
    const frame = container.firstElementChild as HTMLElement;

    expect(frame.className).toContain('bg-primary/10');
    expect(frame.className).toContain('border-primary/40');
  });

  it('stays unselected while it is empty', () => {
    const { container } = render(
      <CustomAnswerField value="   " open onToggle={() => undefined} onChange={() => undefined} />,
    );
    const frame = container.firstElementChild as HTMLElement;

    expect(frame.className).not.toContain('bg-primary/10');
    expect(frame.className).toContain('border-border-soft');
  });
});
