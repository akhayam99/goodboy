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
import { FORMER_NAME_ROWS } from './former-names.rows';

installNavigationHooks();
runNavigationRows({ rows: FORMER_NAME_ROWS });
