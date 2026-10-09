// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => notesBridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('../../../features/resolve/notes/startNoteFix', async () => ({
  startNoteFix: async (params: { sessionId: SessionId; threadIds: ReadonlyArray<string> }) =>
    (await import('./notes.rows')).startFakeNoteFix(params),
}));

import { vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { NOTES_ROWS, notesBridge } from './notes.rows';

installNavigationHooks();
runNavigationRows({ rows: NOTES_ROWS });
