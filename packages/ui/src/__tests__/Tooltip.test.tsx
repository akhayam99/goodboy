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

  it('lays out rich content as a card that wraps', async () => {
    vi.useFakeTimers();
    render(
      <Tooltip
        variant="card"
        content={
          <span>
            <span>Claude</span>
            <span>82% used</span>
          </span>
        }
      >
        <button type="button">btn</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toBe('Claude82% used');
    expect(tip.className).toContain('bg-elevated');
    expect(tip.className).not.toContain('whitespace-nowrap');
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

  it('drops the pending show when it unmounts before the delay', () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <Tooltip content="test tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('keeps one pending show when hover and focus both arrive', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="test tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    fireEvent.focus(screen.getByRole('button'));
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.mouseLeave(screen.getByRole('button'));
    expect(vi.getTimerCount()).toBe(0);
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

describe('Tooltip, rest delay', () => {
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  const renderRest = (props: { readonly isOpen?: boolean } = {}) =>
    render(
      <Tooltip content="card" restDelayMs={800} {...props}>
        <button type="button">btn</button>
      </Tooltip>,
    );

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for the rest delay instead of the default 400ms', () => {
    vi.useFakeTimers();
    renderRest();

    fireEvent.mouseEnter(screen.getByRole('button'));
    advance(400);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(399);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(1);
    expect(screen.getByRole('tooltip').textContent).toBe('card');
  });

  it('restarts the wait on every pointer move until the pointer rests', () => {
    vi.useFakeTimers();
    renderRest();
    const trigger = screen.getByRole('button');

    fireEvent.mouseEnter(trigger);
    advance(700);
    fireEvent.mouseMove(trigger);
    advance(700);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(100);
    expect(screen.getByRole('tooltip')).toBeDefined();
  });

  it('keeps the card open while the pointer moves on the trigger', () => {
    vi.useFakeTimers();
    renderRest();
    const trigger = screen.getByRole('button');

    fireEvent.mouseEnter(trigger);
    advance(800);
    fireEvent.mouseMove(trigger);
    advance(5);

    expect(screen.getByRole('tooltip')).toBeDefined();
  });

  it('drops the pending open when the pointer leaves first', () => {
    vi.useFakeTimers();
    renderRest();
    const trigger = screen.getByRole('button');

    fireEvent.mouseEnter(trigger);
    advance(500);
    fireEvent.mouseLeave(trigger);
    advance(1_000);

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves the ordinary tooltip move-proof, at its own delay', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="plain">
        <button type="button">btn</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');

    fireEvent.mouseEnter(trigger);
    advance(300);
    fireEvent.mouseMove(trigger);
    advance(100);

    expect(screen.getByRole('tooltip').textContent).toBe('plain');
  });

  it('does not open on focus, since a rest needs a pointer', () => {
    vi.useFakeTimers();
    renderRest();

    fireEvent.focus(screen.getByRole('button'));
    advance(2_000);

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows at once when it is told to be open, and closes when told to close', () => {
    const { rerender } = renderRest({ isOpen: true });
    expect(screen.getByRole('tooltip').textContent).toBe('card');

    rerender(
      <Tooltip content="card" restDelayMs={800} isOpen={false}>
        <button type="button">btn</button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
