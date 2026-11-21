// @vitest-environment happy-dom

import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DockRowHandle } from '../components/DockRowHandle';

const GRID_HEIGHT = 812;

type RenderParams = {
  readonly topWeight?: number;
  readonly height?: number;
};

const renderHandle = ({ topWeight = 580, height = GRID_HEIGHT }: RenderParams = {}) => {
  const gridRef = createRef<HTMLDivElement>();
  const onSplit = vi.fn();
  const grid = document.createElement('div');
  Object.defineProperty(grid, 'clientHeight', { value: height });
  document.body.appendChild(grid);
  Object.assign(gridRef, { current: grid });
  render(
    <DockRowHandle
      gridRef={gridRef}
      gridColumn={1}
      keys={['browser', 'terminal']}
      topWeight={topWeight}
      bottomWeight={1000 - topWeight}
      onSplit={onSplit}
    />,
  );
  return { grid, onSplit };
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('the handle between two stacked panels', () => {
  it('starts at the share the panels have and keeps 160px for each', () => {
    renderHandle();
    const handle = screen.getByRole('separator', { name: 'Resize panel height' });

    expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
    expect(handle.getAttribute('aria-valuenow')).toBe('464');
    expect(handle.getAttribute('aria-valuemin')).toBe('160');
    expect(handle.getAttribute('aria-valuemax')).toBe('640');
  });

  it('moves with the arrows and writes the new share for the pair', () => {
    const { grid, onSplit } = renderHandle();

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowDown', shiftKey: true });

    expect(onSplit).toHaveBeenCalledWith({ keys: ['browser', 'terminal'], share: 496 / 800 });
    expect(grid.style.getPropertyValue('grid-template-rows')).toContain('fr');
  });

  it('stops at 160px for the lower panel', () => {
    const { onSplit } = renderHandle({ topWeight: 790 });

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowDown', shiftKey: true });

    expect(onSplit).toHaveBeenCalledWith({ keys: ['browser', 'terminal'], share: 640 / 800 });
  });

  it('keeps its value inside the bounds when the window leaves less room', () => {
    renderHandle({ topWeight: 800, height: 600 });
    const handle = screen.getByRole('separator', { name: 'Resize panel height' });

    expect(handle.getAttribute('aria-valuenow')).toBe('428');
    expect(handle.getAttribute('aria-valuemax')).toBe('428');
  });

  it('goes back to the starting share on a double click', () => {
    const { onSplit } = renderHandle();

    fireEvent.doubleClick(screen.getByRole('separator'));

    expect(onSplit).toHaveBeenCalledWith({ keys: ['browser', 'terminal'], share: null });
  });
});
