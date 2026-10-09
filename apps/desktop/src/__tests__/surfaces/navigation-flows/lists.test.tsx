// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => listsBridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { beforeEach, vi } from 'vitest';
import { installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { LISTS_ROWS, listsBridge, resetListsBridge } from './lists.rows';

installNavigationHooks();
beforeEach(resetListsBridge);
runNavigationRows({ rows: LISTS_ROWS });
