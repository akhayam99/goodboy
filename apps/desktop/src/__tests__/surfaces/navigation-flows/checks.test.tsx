// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: GhBridgeArgs) => checksBridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { vi } from 'vitest';
import { installNavigationHooks, runNavigationRows } from './harness';
import { checksBridge, type GhBridgeArgs } from './checks.runner';
import { CHECKS_ROWS } from './checks.rows';

installNavigationHooks();
runNavigationRows({ rows: CHECKS_ROWS });
