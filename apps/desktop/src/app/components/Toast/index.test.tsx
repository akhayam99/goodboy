// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import {
  ToastProvider,
  useToast,
  useToastLift,
  type ShowToastOptions,
  type ToastKind,
} from './index';

type Shot = {
  readonly kind: ToastKind;
  readonly message: string;
  readonly opts?: ShowToastOptions;
};

let fire: (shot: Shot) => void = () => undefined;

const Harness = () => {
  const { showToast } = useToast();
  fire = ({ kind, message, opts }) => showToast(kind, message, opts);
  return null;
};

const mount = () =>
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

const show = (shot: Shot) => {
  act(() => {
    fire(shot);
  });
};

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  it('dismisses a plain toast after five seconds', () => {
    mount();
    show({ kind: 'success', message: 'Config exported' });
    expect(screen.getByText('Config exported')).toBeTruthy();
    advance(4900);
    expect(screen.queryByText('Config exported')).not.toBeNull();
    advance(200);
    expect(screen.queryByText('Config exported')).toBeNull();
  });

  it('keeps a toast with an action for ten seconds', () => {
    mount();
    show({
      kind: 'info',
      message: 'Agent started',
      opts: { action: { label: 'Open agent', onClick: () => undefined } },
    });
    advance(9000);
    expect(screen.queryByText('Agent started')).not.toBeNull();
    advance(1100);
    expect(screen.queryByText('Agent started')).toBeNull();
  });

  it('never dismisses a persisted preview on its own', () => {
    mount();
    show({ kind: 'error', message: 'disk full', opts: { title: 'Build failed', persist: true } });
    advance(60000);
    expect(screen.getByText('Build failed')).toBeTruthy();
  });

  it('closes a toast from its dismiss button', () => {
    mount();
    show({ kind: 'info', message: 'Copied' });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('runs the action and closes the toast', () => {
    const onClick = vi.fn();
    mount();
    show({
      kind: 'info',
      message: 'Agent started',
      opts: { action: { label: 'Open agent', onClick } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open agent' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Agent started')).toBeNull();
  });

  it('lists toasts in the order they arrived, each with its own live role', () => {
    mount();
    show({ kind: 'error', message: 'first', opts: { title: 'Push failed', persist: true } });
    show({ kind: 'success', message: 'second' });
    show({ kind: 'warning', message: 'third' });
    const cards = [...document.body.querySelectorAll('[role="alert"], [role="status"]')];
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining('First'),
      expect.stringContaining('Second'),
      expect.stringContaining('Third'),
    ]);
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('coalesces a repeat into one card with a count and restarts its timer', () => {
    mount();
    show({ kind: 'warning', message: 'Too many files' });
    advance(4000);
    show({ kind: 'warning', message: 'Too many files' });
    expect(screen.getAllByText('Too many files')).toHaveLength(1);
    expect(screen.getByText('×2')).toBeTruthy();
    advance(4000);
    expect(screen.queryByText('Too many files')).not.toBeNull();
    advance(1100);
    expect(screen.queryByText('Too many files')).toBeNull();
  });

  it('pauses the timer while hovered and resumes on leave', () => {
    mount();
    show({ kind: 'info', message: 'Session archived' });
    advance(3000);
    fireEvent.mouseEnter(screen.getByRole('status'));
    advance(20000);
    expect(screen.queryByText('Session archived')).not.toBeNull();
    fireEvent.mouseLeave(screen.getByRole('status'));
    advance(1900);
    expect(screen.queryByText('Session archived')).not.toBeNull();
    advance(200);
    expect(screen.queryByText('Session archived')).toBeNull();
  });

  it('pauses the timer while focus is inside the card', () => {
    mount();
    show({ kind: 'info', message: 'Session archived' });
    fireEvent.focus(screen.getByRole('button', { name: 'Dismiss notification' }));
    advance(20000);
    expect(screen.queryByText('Session archived')).not.toBeNull();
    fireEvent.blur(screen.getByRole('button', { name: 'Dismiss notification' }));
    advance(5100);
    expect(screen.queryByText('Session archived')).toBeNull();
  });

  it('shows three persisted previews and folds the rest into a chip that opens the log', () => {
    const opened = vi.fn();
    window.addEventListener('goodboy:open-notifications', opened);
    mount();
    ['one', 'two', 'three', 'four', 'five'].forEach((name) =>
      show({ kind: 'error', message: name, opts: { title: `Failed ${name}`, persist: true } }),
    );
    expect(screen.queryByText('Failed one')).toBeNull();
    expect(screen.queryByText('Failed two')).toBeNull();
    expect(screen.getByText('Failed five')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+2 more in notifications' }));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /more in notifications/ })).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(3);
    window.removeEventListener('goodboy:open-notifications', opened);
  });

  it('lifts the stack above a mounted composer and drops back when it unmounts', () => {
    const Composer = () => {
      const ref = useRef<HTMLDivElement>(null);
      useToastLift({ ref });
      return <div ref={ref} data-testid="composer" />;
    };
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: window.innerHeight - 140 } as DOMRect);
    const view = render(
      <ToastProvider>
        <Harness />
        <Composer />
      </ToastProvider>,
    );
    show({ kind: 'info', message: 'Copied' });
    const stack = screen.getByRole('status').parentElement;
    expect(stack?.style.bottom).toBe('148px');
    view.rerender(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    expect(screen.getByRole('status').parentElement?.style.bottom).toBe('');
    rect.mockRestore();
  });
});
