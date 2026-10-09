// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => startBridge(command, args, bridge)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { vi } from 'vitest';
import { bridge, installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { START_PATHS_ROWS, startBridge } from './start-paths.rows';

installNavigationHooks();
runNavigationRows({ rows: START_PATHS_ROWS });
