// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import { openTarget } from './openTarget';
import { PLAIN_CLICK } from './plainClick';

let useAppStore: StoryStore;

const PATH = '/work/ledger-core';
const CODE = { binary: 'code', label: 'VS Code' };
const ZED = { binary: 'zed', label: 'Zed' };

const invokes = (command: string): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === command)
    .map(([, args]) => args);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('opening a folder', () => {
  it.each([
    {
      name: 'the configured editor when it is detected',
      editors: [CODE, ZED],
      editor: null,
      opened: { path: PATH, editor: 'code' },
      isRevealed: false,
    },
    {
      name: 'the first detected editor when the configured one is gone',
      editors: [ZED],
      editor: null,
      opened: { path: PATH, editor: 'zed' },
      isRevealed: false,
    },
    {
      name: 'the editor the menu chose',
      editors: [CODE, ZED],
      editor: 'zed',
      opened: { path: PATH, editor: 'zed' },
      isRevealed: false,
    },
    {
      name: 'the file manager when no editor is set',
      editors: [],
      editor: null,
      opened: null,
      isRevealed: true,
    },
  ])('table: $name', async ({ editors, editor, opened, isRevealed }) => {
    stubStoryInvoke({
      detect_editors: editors,
      open_in_editor: null,
      reveal_in_file_manager: null,
    });
    useAppStore.setState({ detectedEditors: editors });

    const result = await openTarget({
      target: { kind: 'folder', path: PATH, editor },
      sessionId: null,
      event: PLAIN_CLICK,
    });

    expect(result.status).toBe('opened');
    expect(invokes('open_in_editor')).toEqual(opened === null ? [] : [opened]);
    expect(invokes('reveal_in_file_manager')).toEqual(isRevealed ? [{ path: PATH }] : []);
  });

  it('reports a folder the editor cannot open and names the path', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError, detectedEditors: [CODE] });
    stubStoryInvoke({
      detect_editors: [CODE],
      open_in_editor: () => {
        throw new Error("editor binary 'code' not found in PATH");
      },
    });

    const result = await openTarget({
      target: { kind: 'folder', path: PATH, editor: null },
      sessionId: null,
      event: PLAIN_CLICK,
    });

    expect(result.status).toBe('failed');
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: `Couldn't open ${PATH}` }),
    );
  });
});
