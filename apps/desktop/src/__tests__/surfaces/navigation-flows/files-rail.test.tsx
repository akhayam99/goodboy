// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => filesRailBridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeEach, vi } from 'vitest';
import { installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { filesRailBridge } from './files-rail.runner';
import { FILES_RAIL_ROWS } from './files-rail.rows';

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

class BranchPaneWidth {
  private readonly callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    if (target.hasAttribute('data-branch-pane')) {
      this.callback([{ contentRect: { width: target.getBoundingClientRect().width } }]);
    }
  }
  unobserve() {}
  disconnect() {}
}

installNavigationHooks();

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', BranchPaneWidth);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

runNavigationRows({ rows: FILES_RAIL_ROWS });
