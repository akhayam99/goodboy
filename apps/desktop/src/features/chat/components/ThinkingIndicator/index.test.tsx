// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ThinkingIndicator } from './index';

const mockMatchMedia = (reduced: boolean) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

beforeEach(() => {
  vi.useFakeTimers();
  mockMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ThinkingIndicator', () => {
  it('shows a phrase from the active context bucket', () => {
    render(<ThinkingIndicator context="search" />);
    screen.getByText('searching');
  });

  it('rotates the phrase on the tick interval', () => {
    render(<ThinkingIndicator context="run" />);
    screen.getByText('running');
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    screen.getByText('executing');
  });

  it('settles into a reassurance phrase after a long wait', () => {
    render(<ThinkingIndicator context="think" />);
    act(() => {
      vi.advanceTimersByTime(2600 * 8);
    });
    screen.getByText('still working');
  });

  it('freezes on the first phrase under reduced motion', () => {
    mockMatchMedia(true);
    render(<ThinkingIndicator context="think" />);
    screen.getByText('reasoning');
    act(() => {
      vi.advanceTimersByTime(2600 * 4);
    });
    screen.getByText('reasoning');
  });

  it('shows the running node and a live duration instead of a pulsing border', () => {
    const { container } = render(<ThinkingIndicator context="think" />);
    expect(container.querySelector('[data-node-state="running"]')).toBeTruthy();
    expect(container.querySelector('.animate-border-pulse')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    screen.getByText('· 2s');
  });
});
