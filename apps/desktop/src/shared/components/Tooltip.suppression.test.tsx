import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { Tooltip, useHoverSurface } from '@goodboy/ui';
import { brandId, type SessionId } from '@goodboy/types';
import { useHoverCardTarget } from '../../features/workspace/components/SessionHoverCard/useHoverCardTarget';

type Params = { readonly milliseconds: number };

const advance = ({ milliseconds }: Params) => {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Tooltip during hover surface dismissal', () => {
  it('starts a full delay when the surface closes under a pending hover', () => {
    const hover = renderHook(() => {
      const controller = useHoverCardTarget();
      useHoverSurface({ isActive: controller.target !== null });
      return controller;
    });
    act(() => {
      hover.result.current.enter({
        sessionId: brandId<SessionId>({ value: 'harborline-session' }),
        anchor: document.createElement('article'),
      });
    });
    advance({ milliseconds: 500 });
    render(
      <Tooltip content="Restore Harborline">
        <button type="button">Restore</button>
      </Tooltip>,
    );
    act(() => {
      hover.result.current.leave();
      fireEvent.mouseEnter(screen.getByRole('button'));
    });
    advance({ milliseconds: 179 });
    expect(hover.result.current.target).not.toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance({ milliseconds: 1 });
    expect(hover.result.current.target).toBeNull();
    advance({ milliseconds: 399 });
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance({ milliseconds: 1 });
    expect(screen.getByRole('tooltip').textContent).toBe('Restore Harborline');
  });

  it('retains focus that arrived while the surface was suppressing tooltips', () => {
    const surface = renderHook(({ isActive }) => useHoverSurface({ isActive }), {
      initialProps: { isActive: true },
    });
    render(
      <Tooltip content="Restore Harborline">
        <button type="button">Restore</button>
      </Tooltip>,
    );
    act(() => {
      screen.getByRole('button').focus();
    });
    advance({ milliseconds: 500 });
    expect(screen.queryByRole('tooltip')).toBeNull();
    surface.rerender({ isActive: false });
    advance({ milliseconds: 400 });
    expect(screen.getByRole('tooltip').textContent).toBe('Restore Harborline');
  });

  it('keeps a hover pending after the old delay would have expired', () => {
    const surface = renderHook(({ isActive }) => useHoverSurface({ isActive }), {
      initialProps: { isActive: true },
    });
    render(
      <Tooltip content="Restore Harborline">
        <button type="button">Restore</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    advance({ milliseconds: 800 });
    expect(screen.queryByRole('tooltip')).toBeNull();
    surface.rerender({ isActive: false });
    advance({ milliseconds: 400 });
    expect(screen.getByRole('tooltip').textContent).toBe('Restore Harborline');
  });

  it('closes a visible tooltip while a surface is open and waits again after it closes', () => {
    const surface = renderHook(({ isActive }) => useHoverSurface({ isActive }), {
      initialProps: { isActive: false },
    });
    render(
      <Tooltip content="Restore Harborline">
        <button type="button">Restore</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    advance({ milliseconds: 400 });
    screen.getByRole('tooltip');
    surface.rerender({ isActive: true });
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance({ milliseconds: 500 });
    surface.rerender({ isActive: false });
    advance({ milliseconds: 399 });
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance({ milliseconds: 1 });
    screen.getByRole('tooltip');
  });

  it('allows a tooltip inside the surface without exposing an outside tooltip', () => {
    renderHook(() => useHoverSurface({ isActive: true }));
    render(
      <>
        <div data-hover-surface="">
          <Tooltip content="Inside Harborline">
            <button type="button">Inside</button>
          </Tooltip>
        </div>
        <Tooltip content="Outside Harborline">
          <button type="button">Outside</button>
        </Tooltip>
      </>,
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Outside' }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Inside' }));
    advance({ milliseconds: 800 });
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.getByRole('tooltip').textContent).toBe('Inside Harborline');
  });

  it('cleans up pending work when its trigger unmounts', () => {
    const surface = renderHook(({ isActive }) => useHoverSurface({ isActive }), {
      initialProps: { isActive: true },
    });
    const tooltip = render(
      <Tooltip content="Restore Harborline">
        <button type="button">Restore</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    tooltip.unmount();
    surface.rerender({ isActive: false });
    advance({ milliseconds: 800 });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['leave', 'press', 'blur'] as const)('cancels a suppressed hover on %s', (event) => {
    const surface = renderHook(({ isActive }) => useHoverSurface({ isActive }), {
      initialProps: { isActive: true },
    });
    render(
      <Tooltip content="Restore Harborline">
        <button type="button">Restore</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');
    fireEvent.mouseEnter(trigger);
    advance({ milliseconds: 100 });
    if (event === 'leave') {
      fireEvent.mouseLeave(trigger);
    }
    if (event === 'press') {
      fireEvent.pointerDown(trigger);
    }
    if (event === 'blur') {
      fireEvent.blur(trigger);
    }
    surface.rerender({ isActive: false });
    advance({ milliseconds: 800 });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
