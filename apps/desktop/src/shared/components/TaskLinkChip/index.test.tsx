// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TaskLinkChip } from './index';

afterEach(cleanup);

describe('TaskLinkChip', () => {
  it('marks a task linked to a branch with a branch glyph', () => {
    render(<TaskLinkChip provider="linear" identifier="HAR-212" isOnBranch />);

    expect(screen.getByLabelText('Branch task').tagName.toLowerCase()).toBe('svg');
    expect(screen.getByText('HAR-212').tagName).toBe('SPAN');
  });

  it('shows no branch glyph and no button for a plain session task', () => {
    render(<TaskLinkChip provider="linear" identifier="HAR-212" />);

    expect(screen.queryByLabelText('Branch task')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('becomes a pressed toggle with its title when it filters', () => {
    const onClick = vi.fn();
    render(
      <TaskLinkChip
        provider="linear"
        identifier="HBL-400"
        title="Payments revamp"
        isActive
        onClick={onClick}
      />,
    );

    const chip = screen.getByRole('button', { name: /HBL-400/ });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(chip.textContent).toContain('Payments revamp');
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
