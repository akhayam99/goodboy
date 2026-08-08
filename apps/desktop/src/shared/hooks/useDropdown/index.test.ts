// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useDropdown } from './index';

afterEach(cleanup);

describe('useDropdown', () => {
  it('toggles open and closes on Escape', () => {
    const { result } = renderHook(() => useDropdown({}));
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.open).toBe(false);
  });

  it('ignores Escape while the containing flow disables it', () => {
    const { result } = renderHook(() => useDropdown({ isEscapeEnabled: false }));
    act(() => result.current.toggle());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.open).toBe(true);
  });

  it('stays closed when disabled, even on the open event', () => {
    const { result } = renderHook(() => useDropdown({ disabled: true, openEvent: 'test:open' }));
    act(() => result.current.toggle());
    act(() => {
      window.dispatchEvent(new CustomEvent('test:open'));
    });
    expect(result.current.open).toBe(false);
  });

  it('opens on the requested window event', () => {
    const { result } = renderHook(() => useDropdown({ openEvent: 'test:open' }));
    act(() => {
      window.dispatchEvent(new CustomEvent('test:open'));
    });
    expect(result.current.open).toBe(true);
  });

  it('aligns the popup to the requested edge', () => {
    const { result } = renderHook(() => useDropdown({ align: 'end', width: 'w-80' }));
    expect(result.current.popupClassName).toContain('right-0');
    expect(result.current.popupClassName).toContain('w-80');
  });

  it('keeps a backdrop-less dropdown off the app-global scale', () => {
    const { result } = renderHook(() => useDropdown({}));
    expect(result.current.popupClassName).toContain('z-50');
    expect(result.current.popupClassName).not.toContain('z-popover');
  });

  it('lifts a dropdown that renders a backdrop onto the named popover layer', () => {
    const { result } = renderHook(() => useDropdown({ hasBackdrop: true }));
    expect(result.current.popupClassName).toContain('z-popover');
    expect(result.current.popupClassName).not.toContain('z-50');
  });

  it('centres a fixed popup on its trigger when asked', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    const trigger = document.createElement('div');
    document.body.append(trigger);
    trigger.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 500, y: 40, width: 40, height: 24 });
    const { result } = renderHook(() =>
      useDropdown({ align: 'center', expectedWidth: 384, strategy: 'fixed' }),
    );

    act(() => {
      result.current.containerRef.current = trigger;
      result.current.toggle();
    });

    expect(result.current.popupStyle).toMatchObject({ left: 328 });
    trigger.remove();
  });

  it('clamps a fixed popup within the viewport and updates on ancestor scroll', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    let rect = DOMRect.fromRect({ x: 940, y: 500, width: 80, height: 30 });
    const scrollAncestor = document.createElement('div');
    const trigger = document.createElement('div');
    scrollAncestor.append(trigger);
    document.body.append(scrollAncestor);
    trigger.getBoundingClientRect = () => rect;
    const { result } = renderHook(() =>
      useDropdown({
        align: 'end',
        expectedHeight: 320,
        expectedWidth: 384,
        strategy: 'fixed',
        width: 'w-96',
      }),
    );

    act(() => {
      result.current.containerRef.current = trigger;
      result.current.toggle();
    });

    expect(result.current.popupClassName).toContain('fixed');
    expect(result.current.popupClassName).not.toContain('right-0');
    expect(result.current.popupStyle).toMatchObject({
      bottom: 272,
      left: 632,
      maxWidth: 1008,
      maxHeight: 488,
    });

    rect = DOMRect.fromRect({ x: 0, y: 100, width: 80, height: 30 });
    act(() => {
      scrollAncestor.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.popupStyle).toMatchObject({
      left: 8,
      top: 134,
    });

    rect = DOMRect.fromRect({ x: 400, y: 200, width: 80, height: 30 });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.popupStyle).toMatchObject({ left: 96, top: 234 });
    scrollAncestor.remove();
  });
});
