// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Chip } from '../components/Chip';
import { GhostActionButton } from '../components/GhostActionButton';
import { OptionalTooltip } from '../components/OptionalTooltip';
import { Eye } from 'lucide-react';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const hoverTip = ({ element }: { readonly element: HTMLElement }): string | null => {
  vi.useFakeTimers();
  fireEvent.mouseEnter(element);
  act(() => {
    vi.advanceTimersByTime(400);
  });
  return screen.queryByRole('tooltip')?.textContent ?? null;
};

describe('OptionalTooltip', () => {
  it('leaves the child alone, wrapper-free, while it has nothing to say', () => {
    const { container } = render(
      <OptionalTooltip content={undefined}>
        <button type="button" disabled={false}>
          plain
        </button>
      </OptionalTooltip>,
    );

    expect(container.firstElementChild?.tagName).toBe('BUTTON');
    expect(hoverTip({ element: screen.getByRole('button') })).toBeNull();
  });

  it('shows what it has to say in a tooltip on hover', () => {
    render(
      <OptionalTooltip content="Because it is stale">
        <button type="button">stale</button>
      </OptionalTooltip>,
    );

    expect(hoverTip({ element: screen.getByRole('button') })).toBe('Because it is stale');
  });
});

describe('a control with a title prop', () => {
  it('shows a Chip title in a tooltip and never as a native attribute', () => {
    const { container } = render(<Chip tone="neutral" label="Ready" title="Ready to merge" />);

    expect(container.querySelector('[title]')).toBeNull();
    expect(hoverTip({ element: screen.getByText('Ready') })).toBe('Ready to merge');
  });

  it('shows a GhostActionButton title in a tooltip and never as a native attribute', () => {
    const { container } = render(
      <GhostActionButton icon={Eye} label="Watch" title="Watch this run" onClick={vi.fn()} />,
    );

    expect(container.querySelector('[title]')).toBeNull();
    expect(hoverTip({ element: screen.getByRole('button', { name: 'Watch' }) })).toBe(
      'Watch this run',
    );
  });
});
