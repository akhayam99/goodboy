// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useDropdown } from '../useDropdown';
import type { DropdownAlign, DropdownSide } from '../useDropdownDirection';
import { POPOVER_WIDTH_PX } from '../popoverWidth';
import { SHELL_GUTTER_PX } from '../frameGeometry';

const WINDOW_WIDTH = 1024;
const WINDOW_HEIGHT = 700;

type Case = {
  readonly name: string;
  readonly trigger: { readonly x: number; readonly y: number; readonly width: number };
  readonly side: DropdownSide;
  readonly align: DropdownAlign;
  readonly width: number;
  readonly height: number;
  readonly edge: 'start' | 'end' | 'clamped';
};

const BAR_Y = 8;
const BAR_CONTROL = 28;

const CASES: ReadonlyArray<Case> = [
  {
    name: 'back history list',
    trigger: { x: 88, y: BAR_Y, width: BAR_CONTROL },
    side: 'bottom',
    align: 'start',
    width: POPOVER_WIDTH_PX.standard,
    height: 30 * 12 + 8,
    edge: 'start',
  },
  {
    name: 'forward history list',
    trigger: { x: 120, y: BAR_Y, width: BAR_CONTROL },
    side: 'bottom',
    align: 'start',
    width: POPOVER_WIDTH_PX.standard,
    height: 30 * 30 + 8,
    edge: 'start',
  },
  {
    name: 'Sessions with a list taller than the window',
    trigger: { x: 80, y: BAR_Y, width: 96 },
    side: 'bottom',
    align: 'start',
    width: POPOVER_WIDTH_PX.studio,
    height: 32 * 60 + 96,
    edge: 'start',
  },
  {
    name: 'limits overflow',
    trigger: { x: 640, y: BAR_Y, width: 40 },
    side: 'bottom',
    align: 'end',
    width: POPOVER_WIDTH_PX.standard,
    height: 240,
    edge: 'end',
  },
  {
    name: 'providers menu',
    trigger: { x: 700, y: BAR_Y, width: 120 },
    side: 'bottom',
    align: 'end',
    width: POPOVER_WIDTH_PX.studio,
    height: 420,
    edge: 'end',
  },
  {
    name: 'Now',
    trigger: { x: 860, y: BAR_Y, width: 80 },
    side: 'bottom',
    align: 'end',
    width: 360,
    height: 520,
    edge: 'end',
  },
  {
    name: 'bell',
    trigger: { x: 976, y: BAR_Y, width: BAR_CONTROL },
    side: 'bottom',
    align: 'end',
    width: POPOVER_WIDTH_PX.wide,
    height: 900,
    edge: 'end',
  },
  {
    name: 'bell flush with the window edge',
    trigger: { x: WINDOW_WIDTH - BAR_CONTROL, y: BAR_Y, width: BAR_CONTROL },
    side: 'bottom',
    align: 'end',
    width: POPOVER_WIDTH_PX.wide,
    height: 900,
    edge: 'clamped',
  },
  {
    name: 'update card from the rail foot',
    trigger: { x: 0, y: WINDOW_HEIGHT - 96, width: 64 },
    side: 'right',
    align: 'end',
    width: 360,
    height: 140,
    edge: 'clamped',
  },
  {
    name: 'report sheet from the rail foot',
    trigger: { x: 200, y: WINDOW_HEIGHT - 40, width: BAR_CONTROL },
    side: 'right',
    align: 'end',
    width: 560,
    height: 260,
    edge: 'clamped',
  },
];

type PlaceParams = {
  readonly entry: Case;
};

const place = ({ entry }: PlaceParams) => {
  const trigger = document.createElement('div');
  document.body.append(trigger);
  trigger.getBoundingClientRect = () =>
    DOMRect.fromRect({
      x: entry.trigger.x,
      y: entry.trigger.y,
      width: entry.trigger.width,
      height: BAR_CONTROL,
    });
  const { result } = renderHook(() =>
    useDropdown({
      side: entry.side,
      align: entry.align,
      expectedWidth: entry.width,
      expectedHeight: entry.height,
      width: 'w-96',
    }),
  );
  act(() => {
    result.current.containerRef.current = trigger;
    result.current.toggle();
  });
  const style = result.current.popupStyle ?? {};
  const maxHeight = Number(style.maxHeight);
  const shown = Math.min(entry.height, maxHeight);
  const left = Number(style.left);
  const top =
    style.top === undefined ? WINDOW_HEIGHT - Number(style.bottom) - shown : Number(style.top);
  trigger.remove();
  return { left, top, right: left + entry.width, bottom: top + shown, maxHeight };
};

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: WINDOW_WIDTH });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: WINDOW_HEIGHT });
});

afterEach(cleanup);

describe('bar and rail foot popovers in the smallest window keep the shell gutter', () => {
  it('uses one 12px gutter', () => {
    expect(SHELL_GUTTER_PX).toBe(12);
  });

  it.each(CASES)('$name stays inside the gutter on every edge', (entry) => {
    const box = place({ entry });
    expect(box.left).toBeGreaterThanOrEqual(SHELL_GUTTER_PX);
    expect(box.top).toBeGreaterThanOrEqual(SHELL_GUTTER_PX);
    expect(box.right).toBeLessThanOrEqual(WINDOW_WIDTH - SHELL_GUTTER_PX);
    expect(box.bottom).toBeLessThanOrEqual(WINDOW_HEIGHT - SHELL_GUTTER_PX);
  });

  it.each(CASES.filter((entry) => entry.edge === 'start'))(
    '$name keeps its start edge on the trigger',
    (entry) => {
      expect(place({ entry }).left).toBe(entry.trigger.x);
    },
  );

  it.each(CASES.filter((entry) => entry.edge === 'end'))(
    '$name keeps its end edge on the trigger',
    (entry) => {
      expect(place({ entry }).right).toBe(entry.trigger.x + entry.trigger.width);
    },
  );

  it('caps a list taller than the window at the room left minus the gutter', () => {
    const bell = CASES.find((entry) => entry.name === 'bell');
    expect(bell).toBeDefined();
    if (bell === undefined) {
      return;
    }
    const box = place({ entry: bell });
    expect(box.bottom).toBe(WINDOW_HEIGHT - SHELL_GUTTER_PX);
    expect(box.maxHeight).toBeLessThan(bell.height);
  });

  it('keeps the tall Sessions list 500 wide and 12 above the window floor', () => {
    const sessions = CASES.find((entry) => entry.name.startsWith('Sessions'));
    expect(sessions).toBeDefined();
    if (sessions === undefined) {
      return;
    }
    const box = place({ entry: sessions });
    expect(box.right - box.left).toBe(500);
    expect(box.bottom).toBe(WINDOW_HEIGHT - SHELL_GUTTER_PX);
  });
});
