// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: GhBridgeArgs) => pullRequestPageBridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { vi } from 'vitest';
import { installNavigationHooks, runNavigationRows } from './harness';
import { pullRequestPageBridge } from './pull-request-page.runner';
import type { GhBridgeArgs } from './checks.runner';
import { PULL_REQUEST_PAGE_ROWS } from './pull-request-page.rows';

installNavigationHooks();
runNavigationRows({ rows: PULL_REQUEST_PAGE_ROWS });
