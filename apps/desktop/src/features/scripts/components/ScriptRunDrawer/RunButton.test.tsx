// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RunButton } from './RunButton';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RunButton', () => {
  it('runs when it can', () => {
    const onRun = vi.fn();
    render(
      <RunButton canRun blockedReason="ledger-core is still preparing" label="Run" onRun={onRun} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('says why it cannot in a tooltip, never in a native title', () => {
    vi.useFakeTimers();
    render(
      <RunButton
        canRun={false}
        blockedReason="ledger-core is still preparing"
        label="Run again"
        onRun={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: 'Run again' });

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.hasAttribute('title')).toBe(false);
    expect(button.parentElement?.hasAttribute('title')).toBe(false);

    fireEvent.mouseEnter(button.parentElement as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole('tooltip').textContent).toBe('ledger-core is still preparing');
  });
});
