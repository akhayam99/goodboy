import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../store/storyHarness';
import type { StoryStore } from '../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('writeTerminalInput', () => {
  it('stays quiet when the write is accepted', async () => {
    const { writeTerminalInput } = await import('./writeTerminalInput');
    stubStoryInvoke({ terminal_write: () => undefined });

    await writeTerminalInput({ terminalId: 'term-1', encoded: 'bHM=' });

    expect(store.getState().notifications).toHaveLength(0);
  });

  it('tells the owner once when the terminal refuses input', async () => {
    const { writeTerminalInput } = await import('./writeTerminalInput');
    stubStoryInvoke({
      terminal_write: () => Promise.reject({ kind: 'backlogged', message: 'input is backlogged' }),
      db_execute: () => ({ rowsAffected: 1, lastInsertId: 0 }),
      db_select: () => [],
    });

    await writeTerminalInput({ terminalId: 'term-1', encoded: 'bHM=' });
    await writeTerminalInput({ terminalId: 'term-1', encoded: 'bHM=' });

    const notices = store.getState().notifications;
    expect(notices).toHaveLength(1);
    expect(notices[0]?.title).toBe("Terminal isn't accepting input");
    expect(notices[0]?.body).toContain('input is backlogged');
  });
});
