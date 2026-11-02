// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { SkeletonSwap } from '../components/SkeletonSwap';
import { useSkeletonGate } from '../useSkeletonGate';

type HookProps = {
  readonly gateKey: string;
  readonly isLoaded: boolean;
};

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const stubReducedMotion = ({ isReduced }: { readonly isReduced: boolean }) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isReduced && query.includes('reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
};

beforeEach(() => {
  vi.useFakeTimers();
  stubReducedMotion({ isReduced: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const mountGate = (initial: HookProps) =>
  renderHook((props: HookProps) => useSkeletonGate(props), { initialProps: initial });

describe('useSkeletonGate', () => {
  it('shows nothing before 120 ms and never a skeleton when data lands at 30 ms', () => {
    const { result, rerender } = mountGate({ gateKey: 'board', isLoaded: false });
    expect(result.current).toBe('waiting');

    advance(30);
    rerender({ gateKey: 'board', isLoaded: true });

    expect(result.current).toBe('ready');
    advance(600);
    expect(result.current).toBe('ready');
  });

  it('shows the skeleton at 120 ms and holds it to 280 ms when data lands at 130 ms', () => {
    const { result, rerender } = mountGate({ gateKey: 'board', isLoaded: false });

    advance(119);
    expect(result.current).toBe('waiting');
    advance(1);
    expect(result.current).toBe('skeleton');

    advance(10);
    rerender({ gateKey: 'board', isLoaded: true });
    advance(149);
    expect(result.current).toBe('skeleton');
    advance(1);
    expect(result.current).toBe('fading');
    advance(120);
    expect(result.current).toBe('ready');
  });

  it('holds a visible skeleton for 160 ms when data lands at 200 ms and fades to 400 ms', () => {
    const { result, rerender } = mountGate({ gateKey: 'board', isLoaded: false });

    advance(200);
    rerender({ gateKey: 'board', isLoaded: true });
    expect(result.current).toBe('skeleton');

    advance(80);
    expect(result.current).toBe('fading');
    advance(120);
    expect(result.current).toBe('ready');
  });

  it('starts the fade at data time when data lands at 600 ms', () => {
    const { result, rerender } = mountGate({ gateKey: 'board', isLoaded: false });

    advance(600);
    expect(result.current).toBe('skeleton');
    rerender({ gateKey: 'board', isLoaded: true });
    advance(0);
    expect(result.current).toBe('fading');

    advance(120);
    expect(result.current).toBe('ready');
  });

  it('swaps in place at the same times under reduced motion', () => {
    stubReducedMotion({ isReduced: true });
    const { result, rerender } = mountGate({ gateKey: 'board', isLoaded: false });

    advance(200);
    rerender({ gateKey: 'board', isLoaded: true });
    advance(80);

    expect(result.current).toBe('ready');
  });

  it('is ready at once for a mount that already has data, and a refresh never shows a skeleton', () => {
    const { result, rerender } = mountGate({ gateKey: 'board', isLoaded: true });
    expect(result.current).toBe('ready');

    rerender({ gateKey: 'board', isLoaded: false });
    advance(600);

    expect(result.current).toBe('ready');
  });

  it('starts again for a new key', () => {
    const { result, rerender } = mountGate({ gateKey: 'northwind', isLoaded: true });

    rerender({ gateKey: 'cascadia', isLoaded: false });

    expect(result.current).toBe('waiting');
  });
});

describe('SkeletonSwap', () => {
  it('renders the skeleton in the window, then only the content', () => {
    const view = (isLoaded: boolean) => (
      <SkeletonSwap gateKey="board" isLoaded={isLoaded} skeleton={<span>Loading cards</span>}>
        <span>Card list</span>
      </SkeletonSwap>
    );
    const { rerender } = render(view(false));
    expect(screen.queryByText('Loading cards')).toBeNull();

    advance(120);
    screen.getByText('Loading cards');
    expect(screen.queryByText('Card list')).toBeNull();

    rerender(view(true));
    advance(160);
    screen.getByText('Card list');
    screen.getByText('Loading cards');

    advance(120);
    screen.getByText('Card list');
    expect(screen.queryByText('Loading cards')).toBeNull();
  });
});
