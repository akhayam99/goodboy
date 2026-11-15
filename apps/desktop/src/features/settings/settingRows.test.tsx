// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../test/sceneInvoke';
import { SettingsFrame } from '../../app/components/MockScene/scenes/audit/SettingsFrame';
import { seedStorageScene } from '../../app/components/MockScene/scenes/brand/StorageScene';
import { SETTING_ROWS, type SettingRowPage } from './settingRows';

const SETTLE_MS = 2_000;

const pageId = ({ scope, section }: SettingRowPage): string => `${scope}:${section}`;

const PAGES: ReadonlyArray<SettingRowPage> = [
  ...new Map(SETTING_ROWS.map((row) => [pageId(row.page), row.page] as const)).values(),
];

const KEYS: ReadonlySet<string> = new Set(SETTING_ROWS.map((row) => row.key));

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
  await import('./components/SettingsStudio');
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly page: SettingRowPage;
};

const mountPage = async ({ page }: MountParams): Promise<Element> => {
  const { container } = render(<SettingsFrame focus={page} seed={seedPage} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  const detail = container.querySelector('[data-settings-detail]');
  if (detail === null) {
    throw new Error(`no settings detail for ${pageId(page)}`);
  }
  return detail;
};

type TextsParams = {
  readonly detail: Element;
};

const textsOf = ({ detail }: TextsParams): ReadonlySet<string> => {
  const walker = document.createTreeWalker(detail, NodeFilter.SHOW_TEXT);
  const texts = new Set(
    [...detail.querySelectorAll('label, span, p')].map((node) => node.textContent?.trim() ?? ''),
  );
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    texts.add(node.textContent?.trim() ?? '');
  }
  return texts;
};

const seedPage = (): void => {
  seedStorageScene();
  useAppStore.setState({ loadProjectGitStatus: async () => undefined });
};

describe('setting rows registry', () => {
  it('gives every row a unique key', () => {
    expect(KEYS.size).toBe(SETTING_ROWS.length);
  });

  it.each(PAGES.map((page) => ({ id: pageId(page), page })))(
    'renders every registry row of $id, and every rendered row is in the registry',
    async ({ page }) => {
      const detail = await mountPage({ page });
      const texts = textsOf({ detail });
      const expected = SETTING_ROWS.filter((row) => pageId(row.page) === pageId(page));

      expect(expected.filter((row) => !texts.has(row.label)).map((row) => row.key)).toEqual([]);
      const anchored = [...detail.querySelectorAll<HTMLElement>('[data-setting-row]')].map(
        (node) => node.dataset.settingRow ?? '',
      );
      expect(anchored.filter((key) => !KEYS.has(key))).toEqual([]);
    },
  );
});
