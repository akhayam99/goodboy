// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastCard } from './ToastCard';
import type { ToastItem } from './types';

const TOAST: ToastItem = {
  id: 'toast-1',
  kind: 'info',
  message: 'Run started',
  persist: false,
  count: 1,
  revision: 0,
};

const withAction = (label: string): ToastItem => ({
  ...TOAST,
  action: { label, onClick: () => undefined },
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ancestorsOf = (node: HTMLElement): number => {
  let depth = 0;
  let current = node.parentElement;
  while (current !== null) {
    depth += 1;
    current = current.parentElement;
  }
  return depth;
};

describe('ToastCard', () => {
  it('keeps the dismiss button on the card, outside the actions', () => {
    render(<ToastCard toast={withAction('Open agent')} onDismiss={() => undefined} />);

    const dismiss = screen.getByRole('button', { name: 'Dismiss notification' });
    const action = screen.getByRole('button', { name: 'Open agent' });
    expect(screen.getByRole('status').contains(dismiss)).toBe(true);
    expect(action.parentElement?.contains(dismiss)).toBe(false);
  });

  it('keeps the dismiss button out of the actions whatever the action says', () => {
    const labels = ['Open', 'Open the agent transcript'];
    const places = labels.map((label) => {
      const view = render(<ToastCard toast={withAction(label)} onDismiss={() => undefined} />);
      const dismiss = screen.getByRole('button', { name: 'Dismiss notification' });
      const action = screen.getByRole('button', { name: label });
      const place = {
        inActions: action.parentElement?.contains(dismiss),
        depth: ancestorsOf(dismiss),
      };
      view.unmount();
      return place;
    });

    expect(places[0]).toEqual(places[1]);
    expect(places[0]?.inActions).toBe(false);
  });

  it('shows the action on its own row, after the message', () => {
    render(<ToastCard toast={withAction('Open agent')} onDismiss={() => undefined} />);

    const message = screen.getByText('Run started');
    const action = screen.getByRole('button', { name: 'Open agent' });
    expect(message.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(message.parentElement?.contains(action)).toBe(false);
  });

  it('shows no action row when there is no action', () => {
    render(<ToastCard toast={TOAST} onDismiss={() => undefined} />);

    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Dismiss notification']);
  });

  it('dismisses from the button and after the action', () => {
    const onDismiss = vi.fn();
    const onClick = vi.fn();
    render(
      <ToastCard
        toast={{ ...TOAST, action: { label: 'Open agent', onClick } }}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open agent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(onDismiss).toHaveBeenCalledWith({ id: 'toast-1' });
  });

  it('pauses its timer while hovered or focused and resumes after', () => {
    const onDismiss = vi.fn();
    render(<ToastCard toast={TOAST} onDismiss={onDismiss} />);
    const card = screen.getByRole('status');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.mouseEnter(card);
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.mouseLeave(card);
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses the alert role for errors and warnings, status otherwise', () => {
    const view = render(
      <ToastCard toast={{ ...TOAST, kind: 'error' }} onDismiss={() => undefined} />,
    );
    expect(screen.getByRole('alert')).toBeDefined();
    view.unmount();

    render(<ToastCard toast={TOAST} onDismiss={() => undefined} />);
    expect(screen.getByRole('status')).toBeDefined();
  });
});
