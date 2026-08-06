// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { Tooltip } from '../components/Tooltip';

afterEach(cleanup);

describe('Tooltip', () => {
  it('does not show tooltip initially', () => {
    render(
      <Tooltip content="test tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows tooltip after mouse enter delay', async () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="test tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip')).toBeDefined();
    expect(screen.getByRole('tooltip').textContent).toBe('test tip');
    expect(screen.getByRole('tooltip').className).toContain('z-tooltip');
    vi.useRealTimers();
  });

  it('hides tooltip on mouse leave', async () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="test tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip')).toBeDefined();
    fireEvent.mouseLeave(screen.getByRole('button'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });

  it('shows tooltip on focus (keyboard navigation)', async () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="keyboard tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole('button'));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip').textContent).toBe('keyboard tip');
    vi.useRealTimers();
  });

  it('hides tooltip on blur', async () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="keyboard tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole('button'));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.blur(screen.getByRole('button'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });

  it('portals the tooltip into its nearest open dialog', async () => {
    vi.useFakeTimers();
    const { container } = render(
      <dialog open>
        <Tooltip content="dialog tip">
          <button type="button">btn</button>
        </Tooltip>
      </dialog>,
    );
    fireEvent.focus(screen.getByRole('button'));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.contains(screen.getByRole('tooltip'))).toBe(true);
    vi.useRealTimers();
  });
});
