// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ThinkingIndicator } from './index';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ThinkingIndicator', () => {
  it('shows the phrase it is given', () => {
    render(<ThinkingIndicator phrase="Running pnpm in payments-api" />);
    screen.getByText('Running pnpm in payments-api');
  });

  it('keeps the phrase put while time passes, so the line changes only with the activity', () => {
    const { rerender } = render(<ThinkingIndicator phrase="Reading webhook.ts" />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    screen.getByText('Reading webhook.ts');
    rerender(<ThinkingIndicator phrase="Editing ledger.ts" />);
    screen.getByText('Editing ledger.ts');
  });

  it('shows the running node and a live duration instead of a pulsing border', () => {
    const { container } = render(<ThinkingIndicator phrase="Thinking" />);
    expect(container.querySelector('[data-node-state="running"]')).toBeTruthy();
    expect(container.querySelector('.animate-border-pulse')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    screen.getByText('· 2s');
  });
});
