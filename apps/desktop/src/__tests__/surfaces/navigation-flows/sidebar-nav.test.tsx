// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => pinsBridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { beforeEach, vi } from 'vitest';
import { installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { pinsBridge, resetPinsBridge } from './pins.rows';
import { SIDEBAR_NAV_ROWS } from './sidebar-nav.rows';

installNavigationHooks();
beforeEach(resetPinsBridge);
runNavigationRows({ rows: SIDEBAR_NAV_ROWS });
