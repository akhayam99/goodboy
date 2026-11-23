// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { vi } from 'vitest';
import { installNavigationHooks, installStoryBridge, runNavigationRows } from './harness';
import { QUEUE_ROWS } from './queue.rows';

installNavigationHooks();
installStoryBridge();
runNavigationRows({ rows: QUEUE_ROWS });
