// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardDock, type BoardDockEntry } from './index';

const ENTRIES: ReadonlyArray<BoardDockEntry> = [
  { column: 'done', count: 12 },
  { column: 'archived', count: 0 },
];

const dockOf = (container: HTMLElement) =>
  container.querySelector('[data-board-dock]') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BoardDock', () => {
  it('shows one icon button per folded column with its count', () => {
    const onOpen = vi.fn();
    render(<BoardDock entries={ENTRIES} isLassoActive={false} onOpen={onOpen} />);

    const done = screen.getByRole('button', { name: 'Done, 12 sessions' });
    expect(done.getAttribute('aria-expanded')).toBe('false');
    expect(done.getAttribute('aria-controls')).toBe('board-column-done');
    expect(done.textContent).toBe('12');
    expect(screen.getByRole('button', { name: 'Archived, 0 sessions' })).toBeDefined();
    expect(screen.queryByText('Done')).toBeNull();

    fireEvent.click(done);
    expect(onOpen).toHaveBeenCalledWith('done');
  });

  it('caps the count at 99+ and fades an empty column', () => {
    render(
      <BoardDock
        entries={[
          { column: 'done', count: 140 },
          { column: 'archived', count: 0 },
        ]}
        isLassoActive={false}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('99+')).toBeDefined();
    expect(screen.getByText('0').className).toContain('text-faint-foreground');
    expect(
      screen.getByRole('button', { name: 'Archived, 0 sessions' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('widens after the hover intent and narrows after the grace period', () => {
    const { container } = render(
      <BoardDock entries={ENTRIES} isLassoActive={false} onOpen={vi.fn()} />,
    );
    const dock = dockOf(container);
    expect(dock.className).toContain('w-11');

    fireEvent.pointerEnter(dock);
    act(() => vi.advanceTimersByTime(100));
    expect(dock.dataset.wide).toBe('false');
    act(() => vi.advanceTimersByTime(30));
    expect(dock.dataset.wide).toBe('true');
    expect(dock.className).toContain('w-34');
    expect(screen.getByText('Done')).toBeDefined();
    expect(screen.getByText('Archived')).toBeDefined();

    fireEvent.pointerLeave(dock);
    act(() => vi.advanceTimersByTime(150));
    expect(dock.dataset.wide).toBe('true');
    act(() => vi.advanceTimersByTime(60));
    expect(dock.dataset.wide).toBe('false');
  });

  it('widens on keyboard focus like on hover', () => {
    const { container } = render(
      <BoardDock entries={ENTRIES} isLassoActive={false} onOpen={vi.fn()} />,
    );
    const dock = dockOf(container);

    act(() => screen.getByRole('button', { name: 'Done, 12 sessions' }).focus());
    expect(dock.dataset.wide).toBe('true');

    act(() => screen.getByRole('button', { name: 'Done, 12 sessions' }).blur());
    expect(dock.dataset.wide).toBe('false');
  });

  it('never widens while a lasso drag is running', () => {
    const { container, rerender } = render(
      <BoardDock entries={ENTRIES} isLassoActive onOpen={vi.fn()} />,
    );
    const dock = dockOf(container);

    fireEvent.pointerEnter(dock);
    act(() => vi.advanceTimersByTime(500));
    expect(dock.dataset.wide).toBe('false');

    rerender(<BoardDock entries={ENTRIES} isLassoActive={false} onOpen={vi.fn()} />);
    fireEvent.pointerEnter(dock);
    act(() => vi.advanceTimersByTime(200));
    expect(dock.dataset.wide).toBe('true');

    rerender(<BoardDock entries={ENTRIES} isLassoActive onOpen={vi.fn()} />);
    expect(dock.dataset.wide).toBe('false');
  });

  it('stays pinned to the right edge of the board scroller', () => {
    const { container } = render(
      <BoardDock entries={ENTRIES} isLassoActive={false} onOpen={vi.fn()} />,
    );
    const dock = dockOf(container);
    expect(dock.className).toContain('sticky');
    expect(dock.className).toContain('right-0');
    expect(dock.className).toContain('motion-safe:transition-[width]');
  });
});
