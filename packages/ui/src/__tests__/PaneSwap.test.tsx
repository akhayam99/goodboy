// @vitest-environment happy-dom

import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PaneSwap } from '../components/PaneSwap';
import { FACE_SWAP_ATTRIBUTE } from '../faceSwapAttribute';
import { DELAY_STEP_MS, DURATION_QUICK_MS, DURATION_SLOW_MS } from '../motionTimings';

const layOut = (width: number) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width, height: 600 }),
  );
};

const reduceMotion = (isReduced: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: isReduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const layer = (key: string) => document.querySelector<HTMLElement>(`[data-pane-layer="${key}"]`);

const board = { key: 'board', content: <input aria-label="Filter" defaultValue="" /> };
const session = { key: 'harborline', content: <p>Session page</p> };

const swapOf = (activeKey: string) => <PaneSwap activeKey={activeKey} layers={[board, session]} />;

beforeEach(() => {
  vi.useFakeTimers();
  reduceMotion(false);
  layOut(800);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

describe('PaneSwap', () => {
  it('keeps the old layer mounted, inert and fading while the new layer is live at t=0', () => {
    const { rerender } = render(swapOf('board'));

    rerender(swapOf('harborline'));

    const leaving = layer('board');
    expect(leaving?.dataset.paneState).toBe('leaving');
    expect(leaving?.hasAttribute('inert')).toBe(true);
    expect(leaving?.getAttribute('aria-hidden')).toBe('true');
    expect(leaving?.className).toContain('animate-pane-out');
    const entering = layer('harborline');
    expect(entering?.dataset.paneState).toBe('active');
    expect(entering?.hasAttribute('inert')).toBe(false);
    expect(entering?.className).toContain('animate-pane-in');
    screen.getByText('Session page');
  });

  it('hides the old layer after the quick duration without unmounting it', () => {
    const { rerender } = render(swapOf('board'));
    fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'export' } });
    rerender(swapOf('harborline'));

    advance(DURATION_QUICK_MS);

    expect(layer('board')?.dataset.paneState).toBe('hidden');
    expect(layer('board')?.style.display).toBe('none');
    rerender(swapOf('board'));
    expect(screen.getByLabelText<HTMLInputElement>('Filter').value).toBe('export');
  });

  it('swaps in place under reduced motion', () => {
    reduceMotion(true);
    const { rerender } = render(swapOf('board'));

    rerender(swapOf('harborline'));

    expect(layer('board')?.dataset.paneState).toBe('hidden');
    expect(layer('harborline')?.className).not.toContain('animate-pane-in');
  });

  it('swaps in place when the frame has no width', () => {
    layOut(0);
    const { rerender } = render(swapOf('board'));

    rerender(swapOf('harborline'));

    expect(layer('board')?.dataset.paneState).toBe('hidden');
  });

  it('puts a scroller back where it was when its layer comes back', () => {
    const scrolling = {
      key: 'board',
      content: <div data-testid="lane" style={{ overflow: 'auto' }} />,
    };
    const view = (activeKey: string) => (
      <PaneSwap activeKey={activeKey} layers={[scrolling, session]} />
    );
    const { rerender } = render(view('board'));
    const lane = screen.getByTestId('lane');
    lane.scrollTop = 320;
    fireEvent.scroll(lane);

    rerender(view('harborline'));
    advance(DURATION_QUICK_MS);
    lane.scrollTop = 0;
    rerender(view('board'));

    expect(lane.scrollTop).toBe(320);
  });

  it('keeps a selected card and runs no board effect while the session shows', () => {
    const effects = { mounted: 0, cleaned: 0 };
    const Board = () => {
      const [selected, setSelected] = useState<string | null>(null);
      useEffect(() => {
        effects.mounted += 1;
        return () => {
          effects.cleaned += 1;
        };
      }, []);
      return (
        <button
          type="button"
          aria-pressed={selected === 'card'}
          onClick={() => setSelected('card')}
        >
          Retire the legacy export cron job
        </button>
      );
    };
    const view = (activeKey: string) => (
      <PaneSwap activeKey={activeKey} layers={[{ key: 'board', content: <Board /> }, session]} />
    );
    const { rerender } = render(view('board'));
    fireEvent.click(screen.getByRole('button', { name: /Retire the legacy/ }));

    rerender(view('harborline'));
    advance(DURATION_QUICK_MS);
    expect(effects.cleaned).toBe(1);
    rerender(view('board'));

    expect(effects.mounted).toBe(2);
    expect(
      screen.getByRole('button', { name: /Retire the legacy/ }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('moves focus to the new pane title, and leaves a focus held outside alone', () => {
    const layersOf = [
      { key: 'overview', content: <h1>Overview</h1> },
      { key: 'comments', content: <h1>Comments</h1> },
    ];
    const view = (activeKey: string) => (
      <div>
        <button type="button">Outside</button>
        <PaneSwap activeKey={activeKey} layers={layersOf} shouldFocusTitle />
      </div>
    );
    const { rerender } = render(view('overview'));

    rerender(view('comments'));
    expect(document.activeElement?.textContent).toBe('Comments');

    screen.getByRole('button', { name: 'Outside' }).focus();
    rerender(view('overview'));
    expect(document.activeElement?.textContent).toBe('Outside');
  });

  it('does not animate the first paint', () => {
    render(swapOf('board'));

    expect(layer('board')?.className).not.toContain('animate-pane-in');
    expect(layer('harborline')?.dataset.paneState).toBe('hidden');
  });
});

describe('PaneSwap with the face motion', () => {
  const overview = { key: 'overview', content: <h1>Overview</h1> };
  const desk = { key: 'desk', content: <aside aria-label="Desk" /> };
  const faceOf = (activeKey: string) => (
    <PaneSwap activeKey={activeKey} layers={[overview, desk]} motion="face" />
  );
  const swapMs = DURATION_QUICK_MS + DURATION_SLOW_MS + DELAY_STEP_MS;

  afterEach(() => {
    document.body.removeAttribute(FACE_SWAP_ATTRIBUTE);
  });

  it('fades the old face on face-out and holds the new face on face-in, never pane-in', () => {
    const { rerender } = render(faceOf('overview'));

    rerender(faceOf('desk'));

    expect(layer('overview')?.dataset.paneState).toBe('leaving');
    expect(layer('overview')?.className).toContain('animate-face-out');
    expect(layer('overview')?.className).not.toContain('animate-pane-out');
    expect(layer('desk')?.dataset.paneState).toBe('active');
    expect(layer('desk')?.hasAttribute('data-face-in')).toBe(true);
    expect(layer('desk')?.className).not.toContain('animate-pane-in');
  });

  it('marks the window for the whole move, then clears the mark and the face-in', () => {
    const { rerender } = render(faceOf('overview'));

    rerender(faceOf('desk'));
    expect(document.body.getAttribute(FACE_SWAP_ATTRIBUTE)).toBe('desk');

    advance(DURATION_QUICK_MS);
    expect(layer('overview')?.dataset.paneState).toBe('hidden');
    expect(document.body.hasAttribute(FACE_SWAP_ATTRIBUTE)).toBe(true);

    advance(swapMs - DURATION_QUICK_MS);
    expect(document.body.hasAttribute(FACE_SWAP_ATTRIBUTE)).toBe(false);
    expect(layer('desk')?.hasAttribute('data-face-in')).toBe(false);
  });

  it('cuts in place under reduced motion, with no mark on the window', () => {
    reduceMotion(true);
    const { rerender } = render(faceOf('overview'));

    rerender(faceOf('desk'));

    expect(layer('overview')?.dataset.paneState).toBe('hidden');
    expect(layer('desk')?.hasAttribute('data-face-in')).toBe(false);
    expect(document.body.hasAttribute(FACE_SWAP_ATTRIBUTE)).toBe(false);
  });

  it('clears the mark when the swap unmounts mid move', () => {
    const { rerender, unmount } = render(faceOf('overview'));
    rerender(faceOf('desk'));

    unmount();

    expect(document.body.hasAttribute(FACE_SWAP_ATTRIBUTE)).toBe(false);
  });

  it('turns back mid move onto the face it left', () => {
    const { rerender } = render(faceOf('overview'));
    rerender(faceOf('desk'));
    advance(DURATION_QUICK_MS);

    rerender(faceOf('overview'));

    expect(layer('overview')?.hasAttribute('data-face-in')).toBe(true);
    expect(document.body.getAttribute(FACE_SWAP_ATTRIBUTE)).toBe('overview');
    advance(swapMs);
    expect(document.body.hasAttribute(FACE_SWAP_ATTRIBUTE)).toBe(false);
  });
});
