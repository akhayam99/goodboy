// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BitbucketBridgeArgs) =>
    bitbucketPageBridge(command, args),
  ),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { vi } from 'vitest';
import { installNavigationHooks, runNavigationRows } from './harness';
import { bitbucketPageBridge, type BitbucketBridgeArgs } from './bitbucket-page.runner';
import { BITBUCKET_PAGE_ROWS } from './bitbucket-page.rows';

installNavigationHooks();
runNavigationRows({ rows: BITBUCKET_PAGE_ROWS });
