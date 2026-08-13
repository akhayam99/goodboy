// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RefreshCw } from 'lucide-react';
import { GhostActionButton } from '../components/GhostActionButton';

afterEach(cleanup);

describe('GhostActionButton', () => {
  it('renders the label and fires onClick', () => {
    const onClick = vi.fn();
    render(<GhostActionButton icon={RefreshCw} label="Refresh" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('Refresh');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('swaps to the busy label and disables itself while busy', () => {
    const onClick = vi.fn();
    render(
      <GhostActionButton
        icon={RefreshCw}
        label="Refresh"
        busyLabel="Refreshing"
        isBusy
        onClick={onClick}
      />,
    );
    const button = screen.getByRole('button');

    expect(button.textContent).toBe('Refreshing');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps the idle label when busy without a busy label', () => {
    render(<GhostActionButton icon={RefreshCw} label="Refresh" isBusy onClick={vi.fn()} />);
    expect(screen.getByRole('button').textContent).toBe('Refresh');
  });

  it('tints itself when highlighted', () => {
    render(
      <GhostActionButton
        icon={RefreshCw}
        label="Refresh"
        tone="info"
        highlighted
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button').className).toContain('info');
  });
});
