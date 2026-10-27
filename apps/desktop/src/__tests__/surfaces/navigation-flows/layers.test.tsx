// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { beforeEach, vi } from 'vitest';
import { storySpies } from '../../../store/storyHarness';
import { bridge, installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { LAYERS_ROWS } from './layers.rows';

type ArgsParams = {
  readonly value: unknown;
};

const argsOf = ({ value }: ArgsParams): BridgeArgs | undefined =>
  typeof value === 'object' && value !== null ? value : undefined;

installNavigationHooks();
beforeEach(() => {
  storySpies.tauriInvoke.mockImplementation((command?: unknown, args?: unknown) =>
    bridge(String(command), argsOf({ value: args })),
  );
});
runNavigationRows({ rows: LAYERS_ROWS });
