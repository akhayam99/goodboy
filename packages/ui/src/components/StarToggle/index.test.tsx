// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StarToggle } from '.';

afterEach(cleanup);

const renderToggle = (props: Partial<Parameters<typeof StarToggle>[0]> = {}) => {
  const onToggle = vi.fn();
  render(
    <StarToggle
      isStarred={false}
      label="Star ledger-core"
      tooltip="Star to keep it at the top"
      onToggle={onToggle}
      {...props}
    />,
  );
  return { onToggle, button: screen.getByRole('button', { name: 'Star ledger-core' }) };
};

describe('StarToggle', () => {
  it.each([false, true])('reports the starred state (%s) to assistive tech', (isStarred) => {
    const { button } = renderToggle({ isStarred });

    expect(button.getAttribute('aria-pressed')).toBe(String(isStarred));
    expect(button.getAttribute('type')).toBe('button');
  });

  it('keeps the icon out of the accessible name', () => {
    const { button } = renderToggle();

    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('toggles without letting the click reach a parent row', () => {
    const onRow = vi.fn();
    const onToggle = vi.fn();
    render(
      <div onClick={onRow}>
        <StarToggle isStarred label="Star ledger-core" tooltip="Unstar" onToggle={onToggle} />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Star ledger-core' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
  });

  it('cannot be toggled while disabled', () => {
    const { onToggle, button } = renderToggle({ disabled: true });

    fireEvent.click(button);

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('shows a keyboard focus ring', () => {
    const { button } = renderToggle();

    expect(button.className).toContain('focus-visible:ring-2');
  });
});
