// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', async () =>
  (await import('./onboarding.fixtures')).dialogModuleMock(),
);
vi.mock('@tauri-apps/api/path', () => ({ homeDir: vi.fn(async () => '/mock') }));

import { vi } from 'vitest';
import { installNavigationHooks, installStoryBridge, runNavigationRows } from './harness';
import { ONBOARDING_ROWS } from './onboarding.rows';

installNavigationHooks();
installStoryBridge();
runNavigationRows({ rows: ONBOARDING_ROWS });
