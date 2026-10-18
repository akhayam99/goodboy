// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootSplash } from './index';
import { BootSplashExit } from './BootSplashExit';

const stubReducedMotion = ({ isReduced }: { readonly isReduced: boolean }) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: isReduced })),
  );
};

describe('BootSplashExit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('crossfades the splash out over 200 ms, then reports done', () => {
    stubReducedMotion({ isReduced: false });
    const onDone = vi.fn();
    render(<BootSplashExit onDone={onDone} />);

    const overlay = screen.getByTestId('boot-splash-exit');
    expect(overlay.style.opacity).toBe('1');
    expect(overlay.style.transitionDuration).toBe('200ms');
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(overlay.style.opacity).toBe('0');
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('skips the fade under reduced motion', () => {
    stubReducedMotion({ isReduced: true });
    const onDone = vi.fn();
    render(<BootSplashExit onDone={onDone} />);

    expect(onDone).toHaveBeenCalledOnce();
  });

  it('never takes a click from the app underneath', () => {
    stubReducedMotion({ isReduced: false });
    render(<BootSplashExit onDone={vi.fn()} />);

    const overlay = screen.getByTestId('boot-splash-exit');
    expect(overlay.style.pointerEvents).toBe('none');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
  });

  it('holds the tile where the splash and Welcome hold it', () => {
    stubReducedMotion({ isReduced: false });
    const { unmount } = render(<BootSplash phase="ready" error={null} />);
    const splashTop = screen.getByTestId('boot-splash-stack').style.top;
    unmount();
    render(<BootSplashExit onDone={vi.fn()} />);

    expect(screen.getByTestId('boot-splash-stack').style.top).toBe(splashTop);
  });
});
