// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CircleCheck } from 'lucide-react';
import { CountToggle } from '../components/CountToggle';

afterEach(cleanup);

describe('CountToggle', () => {
  it('stays hidden without a count', () => {
    render(
      <CountToggle
        label="Completed"
        count={0}
        isShown={false}
        icon={CircleCheck}
        itemsLabel="agents"
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the count and toggles its pressed state', () => {
    const onChange = vi.fn();
    render(
      <CountToggle
        label="Completed"
        count={3}
        isShown={false}
        icon={CircleCheck}
        itemsLabel="agents"
        onChange={onChange}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Completed (3)' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('builds the title from the label and items noun', () => {
    render(
      <CountToggle
        label="Answered"
        count={2}
        isShown={true}
        icon={CircleCheck}
        itemsLabel="questions"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button').getAttribute('title')).toBe('hide answered questions');
  });
});
