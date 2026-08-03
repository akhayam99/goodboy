// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LEFT_SIDEBAR_STORAGE_KEY } from '@goodboy/ui';
import { SidebarPeekOverlay } from './index';
import { useSidebarPeekHold } from './hold';

afterEach(cleanup);

type Handlers = {
  readonly onEdgeEnter?: () => void;
  readonly onEdgeLeave?: () => void;
  readonly onPanelEnter?: () => void;
  readonly onPanelLeave?: () => void;
  readonly onHold?: () => void;
  readonly onRelease?: () => void;
};

const renderOverlay = (isPeeking: boolean, handlers: Handlers = {}, children = <p>sessions</p>) =>
  render(
    <SidebarPeekOverlay
      isPeeking={isPeeking}
      onEdgeEnter={handlers.onEdgeEnter ?? vi.fn()}
      onEdgeLeave={handlers.onEdgeLeave ?? vi.fn()}
      onPanelEnter={handlers.onPanelEnter ?? vi.fn()}
      onPanelLeave={handlers.onPanelLeave ?? vi.fn()}
      onHold={handlers.onHold ?? vi.fn()}
      onRelease={handlers.onRelease ?? vi.fn()}
    >
      {children}
    </SidebarPeekOverlay>,
  );

describe('SidebarPeekOverlay', () => {
  it('keeps the edge listening while the panel stays away', () => {
    const onEdgeEnter = vi.fn();
    const onEdgeLeave = vi.fn();
    renderOverlay(false, { onEdgeEnter, onEdgeLeave });
    const edge = screen.getByTestId('sidebar-peek-edge');

    expect(screen.queryByRole('region', { name: 'Sessions' })).toBeNull();

    fireEvent.pointerEnter(edge);
    expect(onEdgeEnter).toHaveBeenCalledOnce();

    fireEvent.pointerLeave(edge);
    expect(onEdgeLeave).toHaveBeenCalledOnce();
  });

  it('reports the pointer entering and leaving the panel', () => {
    const onPanelEnter = vi.fn();
    const onPanelLeave = vi.fn();
    renderOverlay(true, { onPanelEnter, onPanelLeave });
    const panel = screen.getByRole('region', { name: 'Sessions' });

    fireEvent.pointerEnter(panel);
    expect(onPanelEnter).toHaveBeenCalledOnce();

    fireEvent.pointerLeave(panel);
    expect(onPanelLeave).toHaveBeenCalledOnce();
  });

  it('hands hold and release down to whatever it wraps', () => {
    const onHold = vi.fn();
    const onRelease = vi.fn();
    const Child = () => {
      const { hold, release } = useSidebarPeekHold();
      return (
        <>
          <button type="button" onClick={hold}>
            hold
          </button>
          <button type="button" onClick={release}>
            release
          </button>
        </>
      );
    };
    renderOverlay(true, { onHold, onRelease }, <Child />);

    fireEvent.click(screen.getByRole('button', { name: 'hold' }));
    expect(onHold).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'release' }));
    expect(onRelease).toHaveBeenCalledOnce();
  });

  it('opens a little wider than the pinned sidebar, not half again', () => {
    localStorage.setItem(LEFT_SIDEBAR_STORAGE_KEY, '300');
    renderOverlay(true);

    expect(screen.getByRole('region', { name: 'Sessions' }).style.width).toBe('360px');
  });

  it('does nothing when nobody provides a hold', () => {
    const Child = () => {
      const { hold, release } = useSidebarPeekHold();
      return (
        <button
          type="button"
          onClick={() => {
            hold();
            release();
          }}
        >
          both
        </button>
      );
    };
    render(<Child />);

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'both' }))).not.toThrow();
  });
});
