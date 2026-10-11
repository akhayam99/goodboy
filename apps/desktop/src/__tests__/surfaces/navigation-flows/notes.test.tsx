// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => notesBridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { vi } from 'vitest';
import { installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { NOTES_ROWS, notesBridge } from './notes.rows';

installNavigationHooks();
runNavigationRows({ rows: NOTES_ROWS });
