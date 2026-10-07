// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeEach, vi } from 'vitest';
import { bridge, installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { DRAWER_ROWS } from './drawers.rows';

const NARROW_COLUMN_PX = 1000;

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

class NarrowDrawerColumns {
  private readonly callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    if (target.querySelector(':scope > [data-drawer-main]') !== null) {
      this.callback([{ contentRect: { width: NARROW_COLUMN_PX } }]);
    }
  }
  unobserve() {}
  disconnect() {}
}

installNavigationHooks();

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', NarrowDrawerColumns);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

runNavigationRows({ rows: DRAWER_ROWS });
