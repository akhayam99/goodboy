// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Reveal } from '../components/Reveal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const withTransition = () => {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = real(element);
    return new Proxy(style, {
      get: (target, key) =>
        key === 'transitionDuration' ? '0.2s' : Reflect.get(target, key, target),
    });
  });
};

const frameOf = (text: string): HTMLElement | null =>
  screen.queryByText(text)?.closest<HTMLElement>('[data-state]') ?? null;

describe('Reveal', () => {
  it('renders nothing while closed and mounts the children once open', () => {
    const { rerender } = render(<Reveal open={false}>Body</Reveal>);
    expect(screen.queryByText('Body')).toBeNull();

    rerender(<Reveal open>Body</Reveal>);
    expect(frameOf('Body')?.getAttribute('data-state')).toBe('open');
  });

  it('unmounts at once when no transition runs, as with reduced motion', () => {
    const onClosed = vi.fn();
    const { rerender } = render(
      <Reveal open onClosed={onClosed}>
        Body
      </Reveal>,
    );

    rerender(
      <Reveal open={false} onClosed={onClosed}>
        Body
      </Reveal>,
    );

    expect(screen.queryByText('Body')).toBeNull();
    expect(onClosed).toHaveBeenCalledOnce();
  });

  it('keeps the children through the collapse and unmounts on transition end', () => {
    withTransition();
    const onClosed = vi.fn();
    const { rerender } = render(
      <Reveal open onClosed={onClosed}>
        Body
      </Reveal>,
    );

    rerender(
      <Reveal open={false} onClosed={onClosed}>
        Body
      </Reveal>,
    );
    const frame = frameOf('Body');
    expect(frame?.getAttribute('data-state')).toBe('closed');
    expect(onClosed).not.toHaveBeenCalled();

    fireEvent.transitionEnd(frame as HTMLElement);
    expect(screen.queryByText('Body')).toBeNull();
    expect(onClosed).toHaveBeenCalledOnce();
  });

  it('settles on a timer when the transition end never arrives', () => {
    vi.useFakeTimers();
    withTransition();
    const { rerender } = render(<Reveal open>Body</Reveal>);

    rerender(<Reveal open={false}>Body</Reveal>);
    expect(screen.queryByText('Body')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText('Body')).toBeNull();
  });

  it('grows from zero height when it opens with a transition', () => {
    withTransition();
    const { rerender } = render(<Reveal open={false}>Body</Reveal>);

    rerender(<Reveal open>Body</Reveal>);
    const frame = frameOf('Body');
    expect(frame?.getAttribute('data-state')).toBe('open');
    expect(frame?.className).toContain('grid-rows-[1fr]');
    expect(frame?.firstElementChild?.className).toContain('overflow-hidden');

    fireEvent.transitionEnd(frame as HTMLElement);
    expect(frame?.firstElementChild?.className).not.toContain('overflow-hidden');
  });
});
