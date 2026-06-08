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
    expect(screen.getByText('sniffing through files')).toBeTruthy();
  });

  it('rotates the phrase on the tick interval', () => {
    render(<ThinkingIndicator context="run" />);
    expect(screen.getByText('digging in')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.getByText('off to fetch')).toBeTruthy();
  });

  it('settles into a reassurance phrase after a long wait', () => {
    render(<ThinkingIndicator context="think" />);
    act(() => {
      vi.advanceTimersByTime(2600 * 8);
    });
    expect(screen.getByText('still on the trail')).toBeTruthy();
  });

  it('freezes on the first phrase under reduced motion', () => {
    mockMatchMedia(true);
    render(<ThinkingIndicator context="think" />);
    expect(screen.getByText('sniffing it out')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2600 * 4);
    });
    expect(screen.getByText('sniffing it out')).toBeTruthy();
  });
});
