// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => filesRailBridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { vi } from 'vitest';
import { installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { filesRailBridge } from './files-rail.runner';
import { FILES_RAIL_ROWS } from './files-rail.rows';

installNavigationHooks();
runNavigationRows({ rows: FILES_RAIL_ROWS });
