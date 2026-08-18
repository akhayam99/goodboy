// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { Tooltip } from '../components/Tooltip';

afterEach(cleanup);

const anchorOf = (trigger: HTMLElement): HTMLElement => {
  const anchor = trigger.parentElement;
  if (anchor === null) {
    throw new Error('the trigger has no anchor to hover');
  }
  return anchor;
};

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

  it('still opens while the trigger is disabled, from the anchor around it', async () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="nothing to send yet">
        <button type="button" disabled>
          btn
        </button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(anchorOf(screen.getByRole('button')));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip').textContent).toBe('nothing to send yet');
    vi.useRealTimers();
  });

  it('takes pointer events off the disabled trigger so the anchor receives them', () => {
    render(
      <Tooltip content="nothing to send yet">
        <button type="button" disabled>
          btn
        </button>
      </Tooltip>,
    );
    expect(anchorOf(screen.getByRole('button')).className).toContain(
      '[&_:disabled]:pointer-events-none',
    );
  });

  it('leaves the live trigger hoverable, anchor or not', () => {
    render(
      <Tooltip content="send">
        <button type="button" disabled={false}>
          btn
        </button>
      </Tooltip>,
    );
    expect(anchorOf(screen.getByRole('button')).className).not.toContain('pointer-events-none');
  });

  it('adds nothing around a trigger that can never go disabled', () => {
    const { container } = render(
      <Tooltip content="send">
        <button type="button">btn</button>
      </Tooltip>,
    );
    expect(anchorOf(screen.getByRole('button'))).toBe(container);
  });

  it('lets a trigger that is out of flow shape its own anchor', () => {
    render(
      <Tooltip content="remove step" anchorClassName="absolute right-1.5 top-1.5">
        <button type="button" disabled={false}>
          btn
        </button>
      </Tooltip>,
    );
    expect(anchorOf(screen.getByRole('button')).className).toContain('absolute right-1.5 top-1.5');
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
