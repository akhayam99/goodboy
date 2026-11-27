// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDockDragStore, type DockDragView } from '../dockDragStore';
import type { DockDropZone } from '../dockDropZonesOf';
import { dockZoneStepOf } from '../dockZoneStepOf';
import { useDockDragKeys, type DockKeyEvent } from '../useDockDragKeys';

const zoneOf = (id: string): DockDropZone => ({
  id,
  target: { at: 'page' },
  paneKey: null,
  placement: 'left',
  scope: 'dock',
  layer: 3,
  rect: { x: 0, y: 0, width: 1, height: 1 },
  card: { x: 0, y: 0, width: 1, height: 1 },
  anchor: { x: 0, y: 0, align: 'center' },
  label: 'Place left',
  layout: { columns: [], groups: {} },
  swap: null,
});

const ZONES = ['dock-left', 'above:terminal', 'merge:terminal', 'dock-right'].map(zoneOf);

const viewOf = (hoverId: string | null): DockDragView => ({
  key: 'browser',
  title: 'Browser',
  x: 0,
  y: 0,
  zones: ZONES,
  hoverId,
  names: {},
  ghost: null,
  isSwap: false,
  position: null,
  status: '',
});

type Pressed = {
  readonly press: (key: string) => void;
  readonly prevented: () => number;
};

const pressedOn = (keys: {
  readonly onKeyDown: (params: { readonly event: DockKeyEvent }) => void;
}): Pressed => {
  let count = 0;
  return {
    press: (key) =>
      keys.onKeyDown({
        event: {
          key,
          preventDefault: () => {
            count += 1;
          },
          stopPropagation: () => undefined,
        },
      }),
    prevented: () => count,
  };
};

describe('the keys while a panel is dragged', () => {
  it('chooses nothing on Enter when no card is chosen', () => {
    const store = createDockDragStore();
    store.set({ view: viewOf(null) });
    const onDrop = vi.fn();
    const onStep = vi.fn();
    const { result } = renderHook(() => useDockDragKeys({ store, onStep, onDrop }));
    const { press } = pressedOn(result.current);

    press('Enter');

    expect(onDrop).not.toHaveBeenCalled();
    expect(onStep).not.toHaveBeenCalled();
  });

  it('drops on the chosen card with Enter', () => {
    const store = createDockDragStore();
    store.set({ view: viewOf('merge:terminal') });
    const onDrop = vi.fn();
    const { result } = renderHook(() => useDockDragKeys({ store, onStep: vi.fn(), onDrop }));
    const { press } = pressedOn(result.current);

    press('Enter');

    expect(onDrop).toHaveBeenCalledWith({ id: 'merge:terminal' });
  });

  it('walks the cards in screen order with the arrows, and wraps', () => {
    const store = createDockDragStore();
    store.set({ view: viewOf(null) });
    const seen: Array<string> = [];
    const { result } = renderHook(() =>
      useDockDragKeys({
        store,
        onStep: ({ id }) => {
          seen.push(id);
          store.set({ view: viewOf(id) });
        },
        onDrop: vi.fn(),
      }),
    );
    const { press } = pressedOn(result.current);

    press('ArrowRight');
    press('ArrowDown');
    press('ArrowRight');
    press('ArrowRight');
    press('ArrowRight');
    press('ArrowLeft');

    expect(seen).toEqual([
      'dock-left',
      'above:terminal',
      'merge:terminal',
      'dock-right',
      'dock-left',
      'dock-right',
    ]);
  });

  it('does nothing while no drag is active', () => {
    const store = createDockDragStore();
    const onDrop = vi.fn();
    const { result } = renderHook(() => useDockDragKeys({ store, onStep: vi.fn(), onDrop }));
    const pressed = pressedOn(result.current);

    pressed.press('Enter');
    pressed.press('ArrowRight');

    expect(onDrop).not.toHaveBeenCalled();
    expect(pressed.prevented()).toBe(0);
  });
});

describe('a step over the cards', () => {
  it('starts at the last card going back from nothing', () => {
    expect(dockZoneStepOf({ zones: ZONES, hoverId: null, direction: 'previous' })).toBe(
      'dock-right',
    );
  });

  it('finds nothing when there is no card', () => {
    expect(dockZoneStepOf({ zones: [], hoverId: null, direction: 'next' })).toBeNull();
  });
});
