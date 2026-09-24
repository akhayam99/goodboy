// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RefreshCw } from 'lucide-react';
import { IconButton } from '../components/IconButton';

const anchorOf = (trigger: HTMLElement): HTMLElement => {
  const anchor = trigger.parentElement;
  if (anchor === null) {
    throw new Error('the trigger has no anchor to hover');
  }
  return anchor;
};

const hover = (button: HTMLElement): void => {
  vi.useFakeTimers();
  fireEvent.mouseEnter(button);
  act(() => {
    vi.advanceTimersByTime(400);
  });
  vi.useRealTimers();
};

describe('IconButton', () => {
  afterEach(cleanup);

  it('names itself for assistive tech and leaves the native tooltip alone', () => {
    render(<IconButton icon={RefreshCw} label="Refresh issues" />);
    const button = screen.getByRole('button', { name: 'Refresh issues' });
    expect(button.getAttribute('title')).toBeNull();
  });

  it('explains itself to the pointer through the shared tooltip', () => {
    render(<IconButton icon={RefreshCw} label="Refresh issues" />);
    hover(screen.getByRole('button', { name: 'Refresh issues' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Refresh issues');
  });

  it('lets the caller say more in the tooltip than the accessible name', () => {
    render(
      <IconButton icon={RefreshCw} label="Refresh issues" tooltip="Refresh issues from GitHub" />,
    );
    const button = screen.getByRole('button', { name: 'Refresh issues' });
    hover(button);
    expect(screen.getByRole('tooltip').textContent).toBe('Refresh issues from GitHub');
  });

  it('keeps explaining itself while disabled, and still without a native title', () => {
    render(<IconButton icon={RefreshCw} label="Refresh issues" disabled />);
    const button = screen.getByRole('button', { name: 'Refresh issues' });
    expect(button.getAttribute('title')).toBeNull();
    hover(anchorOf(button));
    expect(screen.getByRole('tooltip').textContent).toBe('Refresh issues');
  });

  it('reports the action back to the caller', () => {
    const onClick = vi.fn();
    render(<IconButton icon={RefreshCw} label="Refresh issues" onClick={onClick} />);
    screen.getByRole('button', { name: 'Refresh issues' }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('refuses the action while disabled', () => {
    const onClick = vi.fn();
    render(<IconButton icon={RefreshCw} label="Refresh issues" disabled onClick={onClick} />);
    screen.getByRole('button', { name: 'Refresh issues' }).click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps a toned action accessible', () => {
    render(<IconButton icon={RefreshCw} label="Delete plan" tone="danger" />);
    expect(screen.getByRole('button', { name: 'Delete plan' })).toBeDefined();
  });

  it('keeps the default action accessible', () => {
    render(<IconButton icon={RefreshCw} label="Refresh issues" />);
    expect(screen.getByRole('button', { name: 'Refresh issues' })).toBeDefined();
  });
});
