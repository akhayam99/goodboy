// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act, within } from '@testing-library/react';
import { Tooltip } from '../components/Tooltip';
import { registerEscapeLayer } from '../escape';
import { registerShortcutGlyphs } from '../shortcutGlyphs';

afterEach(cleanup);

const focusByKeyboard = (element: HTMLElement): void => {
  act(() => {
    element.focus();
  });
};

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

  it('draws every label on the one floating surface and wraps long text', async () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="A long line of text that has to wrap">
        <button type="button">btn</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    const tip = screen.getByRole('tooltip');
    expect(tip.className).toContain('bg-floating');
    expect(tip.className).toContain('shadow-lg');
    expect(tip.className).toContain('whitespace-pre-line');
    expect(tip.className).not.toContain('bg-elevated');
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

  it('opens at once when focus arrives during a pending hover, leaving no timer behind', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="test tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(vi.getTimerCount()).toBe(1);
    focusByKeyboard(screen.getByRole('button'));
    expect(screen.getByRole('tooltip').textContent).toBe('test tip');
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('shows tooltip on focus (keyboard navigation) with no delay', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="keyboard tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    focusByKeyboard(screen.getByRole('button'));
    expect(screen.getByRole('tooltip').textContent).toBe('keyboard tip');
    vi.useRealTimers();
  });

  it('keeps the delay for a focus that is not from the keyboard', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip').textContent).toBe('tip');
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

describe('Tooltip, dismissal and suppression', () => {
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides on pointer down and stays hidden while the pointer is still on the control', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');
    fireEvent.mouseEnter(trigger);
    advance(400);
    expect(screen.getByRole('tooltip')).toBeDefined();

    fireEvent.pointerDown(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(trigger);
    advance(1_000);

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('hides on Escape', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    focusByKeyboard(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes with Escape without swallowing it from the layer beneath', () => {
    const onEscape = vi.fn();
    const unregister = registerEscapeLayer(onEscape);
    render(
      <Tooltip content="tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    focusByKeyboard(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(onEscape).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('ignores other keys', () => {
    render(
      <Tooltip content="tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    focusByKeyboard(screen.getByRole('button'));

    fireEvent.keyDown(document, { key: 'a' });

    expect(screen.getByRole('tooltip')).toBeDefined();
  });

  it('does not open while suppressed, by hover or by focus', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="tip" isSuppressed>
        <button type="button">btn</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');

    fireEvent.mouseEnter(trigger);
    focusByKeyboard(trigger);
    advance(1_000);

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes an open tooltip the moment it becomes suppressed', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <Tooltip content="tip">
        <button type="button">btn</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    advance(400);
    expect(screen.getByRole('tooltip')).toBeDefined();

    rerender(
      <Tooltip content="tip" isSuppressed>
        <button type="button">btn</button>
      </Tooltip>,
    );

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not pop open on the focus a closing menu hands back', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <Tooltip content="tip" isSuppressed>
        <button type="button">btn</button>
      </Tooltip>,
    );
    rerender(
      <Tooltip content="tip" isSuppressed={false}>
        <button type="button">btn</button>
      </Tooltip>,
    );

    focusByKeyboard(screen.getByRole('button'));

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens with no delay when another tooltip closed less than 300ms ago', () => {
    vi.useFakeTimers();
    render(
      <>
        <Tooltip content="first">
          <button type="button">one</button>
        </Tooltip>
        <Tooltip content="second">
          <button type="button">two</button>
        </Tooltip>
      </>,
    );
    const one = screen.getByRole('button', { name: 'one' });
    const two = screen.getByRole('button', { name: 'two' });
    fireEvent.mouseEnter(one);
    advance(400);
    fireEvent.mouseLeave(one);
    advance(299);

    fireEvent.mouseEnter(two);

    expect(screen.getByRole('tooltip').textContent).toBe('second');
  });

  it('is back to the full delay once 300ms have passed', () => {
    vi.useFakeTimers();
    render(
      <>
        <Tooltip content="first">
          <button type="button">one</button>
        </Tooltip>
        <Tooltip content="second">
          <button type="button">two</button>
        </Tooltip>
      </>,
    );
    const one = screen.getByRole('button', { name: 'one' });
    const two = screen.getByRole('button', { name: 'two' });
    fireEvent.mouseEnter(one);
    advance(400);
    fireEvent.mouseLeave(one);
    advance(300);

    fireEvent.mouseEnter(two);

    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(400);
    expect(screen.getByRole('tooltip').textContent).toBe('second');
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

describe('Tooltip shortcut', () => {
  const hover = (): void => {
    vi.useFakeTimers();
    fireEvent.mouseEnter(screen.getByRole('button'));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();
  };

  it('draws the label and the keys as separate nodes with no parentheses', () => {
    registerShortcutGlyphs({ lookup: ({ id }) => (id === 'ask.open' ? '⌘L' : '') });
    render(
      <Tooltip content="Ask an agent" shortcut="ask.open">
        <button type="button">btn</button>
      </Tooltip>,
    );
    hover();

    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toBe('Ask an agent⌘L');
    expect(tip.textContent).not.toContain('(');
    expect(within(tip).getByText('Ask an agent').tagName).toBe('SPAN');
    expect(tip.querySelector('kbd')?.textContent).toBe('⌘L');
  });

  it('prints the label alone when the shortcut has no keys', () => {
    registerShortcutGlyphs({ lookup: () => '' });
    render(
      <Tooltip content="Ask an agent" shortcut="ask.open">
        <button type="button">btn</button>
      </Tooltip>,
    );
    hover();

    expect(screen.getByRole('tooltip').textContent).toBe('Ask an agent');
    expect(screen.getByRole('tooltip').querySelector('kbd')).toBeNull();
  });

  it('shows nothing while its content is empty', () => {
    render(
      <Tooltip content={undefined}>
        <button type="button">btn</button>
      </Tooltip>,
    );
    hover();

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes when an ancestor scrolls so it never stays at the old place', async () => {
    vi.useFakeTimers();
    render(
      <div data-testid="scroller">
        <Tooltip content="test tip">
          <button type="button">btn</button>
        </Tooltip>
      </div>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip')).toBeDefined();
    act(() => {
      fireEvent.scroll(screen.getByTestId('scroller'));
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });

  it('keeps a controlled tooltip open and placed when an ancestor scrolls', async () => {
    render(
      <div data-testid="scroller">
        <Tooltip content="test tip" isOpen>
          <button type="button">btn</button>
        </Tooltip>
      </div>,
    );
    act(() => {
      fireEvent.scroll(screen.getByTestId('scroller'));
    });
    const tip = screen.getByRole('tooltip');
    expect(tip.style.visibility).toBe('visible');
    expect(tip.style.top).not.toBe('-9999px');
  });
});

describe('Tooltip label surface', () => {
  it('paints the label on the floating surface with foreground text', () => {
    render(
      <Tooltip content="Open Harborline" isOpen>
        <button type="button">btn</button>
      </Tooltip>,
    );
    const classes = screen.getByRole('tooltip').className;
    expect(classes).toContain('bg-floating');
    expect(classes).toContain('border-border-soft');
    expect(classes).toContain('text-foreground');
    expect(classes).toContain('max-w-70');
    expect(classes).toContain('motion-safe:animate-popover-in');
    expect(classes).not.toContain('bg-foreground');
    expect(classes).not.toContain('text-background');
  });

  it('draws the shortcut as a plain Kbd with no inverted tone', () => {
    registerShortcutGlyphs({ lookup: ({ id }) => (id === 'search.open' ? '⌘K' : '') });
    render(
      <Tooltip content="Search" shortcut="search.open" isOpen>
        <button type="button">btn</button>
      </Tooltip>,
    );
    const kbd = screen.getByRole('tooltip').querySelector('kbd');
    expect(kbd?.textContent).toBe('⌘K');
    expect(kbd?.className).not.toContain('text-background');
  });
});

describe('Tooltip description', () => {
  it('points the trigger at the tooltip while it is open', () => {
    render(
      <Tooltip content="Last run 14:02 on Harborline" isOpen>
        <button type="button">Build</button>
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip');
    expect(tip.id).not.toBe('');
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe(tip.id);
    expect(
      screen.getByRole('button', { description: 'Last run 14:02 on Harborline' }),
    ).toBeDefined();
  });

  it('sets no description while the tooltip is closed', () => {
    render(
      <Tooltip content="Last run 14:02 on Harborline">
        <button type="button">Build</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBeNull();
  });

  it('skips the description when the text repeats the trigger name', () => {
    render(
      <Tooltip content="Open Northwind" isOpen>
        <button type="button" aria-label="Open Northwind">
          x
        </button>
      </Tooltip>,
    );
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBeNull();
  });

  it('describes a trigger whose name differs from the text', () => {
    render(
      <Tooltip content="Resets in 3 hours" isOpen>
        <button type="button" aria-label="Usage">
          x
        </button>
      </Tooltip>,
    );
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe(
      screen.getByRole('tooltip').id,
    );
  });

  it('keeps the trigger own description next to the tooltip', () => {
    render(
      <Tooltip content="Resets in 3 hours" isOpen>
        <button type="button" aria-describedby="hint-acme">
          Usage
        </button>
      </Tooltip>,
    );
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe(
      `hint-acme ${screen.getByRole('tooltip').id}`,
    );
  });

  it('restores the trigger own description once the tooltip closes', () => {
    const { rerender } = render(
      <Tooltip content="Resets in 3 hours" isOpen>
        <button type="button" aria-describedby="hint-acme">
          Usage
        </button>
      </Tooltip>,
    );
    rerender(
      <Tooltip content="Resets in 3 hours" isOpen={false}>
        <button type="button" aria-describedby="hint-acme">
          Usage
        </button>
      </Tooltip>,
    );
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe('hint-acme');
  });

  it('describes the trigger inside the anchor of a disabled control', () => {
    render(
      <Tooltip content="Checks are still running" isOpen>
        <button type="button" disabled>
          Merge
        </button>
      </Tooltip>,
    );
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe(
      screen.getByRole('tooltip').id,
    );
  });
});
