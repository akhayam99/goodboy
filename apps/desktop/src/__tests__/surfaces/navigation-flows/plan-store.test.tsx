// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { vi } from 'vitest';
import { bridge, installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { PLAN_STORE_ROWS } from './plan-store.rows';

installNavigationHooks();
runNavigationRows({ rows: PLAN_STORE_ROWS });
