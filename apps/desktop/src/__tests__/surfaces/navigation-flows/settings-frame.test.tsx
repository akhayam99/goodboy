// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { beforeEach, vi } from 'vitest';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { bridge, installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { SETTINGS_FRAME_ROWS } from './settings-frame.rows';

installNavigationHooks();

beforeEach(() => {
  window.localStorage.removeItem(STORAGE_KEYS.sessionSidebarCollapsed);
});

runNavigationRows({ rows: SETTINGS_FRAME_ROWS });
