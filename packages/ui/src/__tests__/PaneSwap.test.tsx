// @vitest-environment happy-dom

import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PaneSwap } from '../components/PaneSwap';
import { DURATION_QUICK_MS } from '../motionTimings';

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
