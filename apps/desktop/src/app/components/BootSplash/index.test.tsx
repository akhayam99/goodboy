// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../../../shared/lib/editor', () => ({
  openInEditor: vi.fn(),
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootSplash } from './index';

describe('BootSplash slow boot recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('keeps the normal splash unchanged below the slow threshold', () => {
    render(<BootSplash phase="loading-settings" error={null} />);

    act(() => {
      vi.advanceTimersByTime(9_000);
    });

    expect(screen.queryByText('this is taking longer than usual')).toBeNull();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('offers retry after the phase takes longer than usual', () => {
    const onRetry = vi.fn();
    render(<BootSplash phase="detecting-cli" error={null} onRetry={onRetry} />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByText('this is taking longer than usual')).toBeDefined();
    expect(screen.getByText('10s')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('resets the escalation when the phase changes', () => {
    const { rerender } = render(
      <BootSplash phase="loading-settings" error={null} onRetry={vi.fn()} />,
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    rerender(<BootSplash phase="detecting-cli" error={null} onRetry={vi.fn()} />);

    expect(screen.queryByText('this is taking longer than usual')).toBeNull();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });
});
