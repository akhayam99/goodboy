// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: GhBridgeArgs) => gitlabPageBridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { vi } from 'vitest';
import { installNavigationHooks, runNavigationRows } from './harness';
import type { GhBridgeArgs } from './checks.runner';
import { gitlabPageBridge } from './gitlab-page.runner';
import { GITLAB_PAGE_ROWS } from './gitlab-page.rows';

installNavigationHooks();
runNavigationRows({ rows: GITLAB_PAGE_ROWS });
