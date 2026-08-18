// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RefreshCw } from 'lucide-react';
import { IconButton } from '../components/IconButton';

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

  it('falls back to a native title while disabled, the one state hover cannot reach', () => {
    render(<IconButton icon={RefreshCw} label="Refresh issues" disabled />);
    expect(screen.getByRole('button', { name: 'Refresh issues' }).getAttribute('title')).toBe(
      'Refresh issues',
    );
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

  it('tints itself when the action carries a tone', () => {
    render(<IconButton icon={RefreshCw} label="Delete plan" tone="danger" />);
    const classes = screen.getByRole('button', { name: 'Delete plan' }).className;
    expect(classes).toContain('text-danger');
    expect(classes).toContain('border-danger/20');
    expect(classes).toContain('hover:border-danger/40');
  });

  it('stays muted at the default tone', () => {
    render(<IconButton icon={RefreshCw} label="Refresh issues" />);
    const classes = screen.getByRole('button', { name: 'Refresh issues' }).className;
    expect(classes).toContain('text-muted-foreground');
    expect(classes).not.toContain('text-danger');
  });
});
