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
import { aWorkflowRun } from '@goodboy/types/testing';
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
import { SETTING_ROWS, isRunDefaultsFocus, type SettingRowPage } from './settingRows';

const SETTLE_MS = 2_000;

const pageId = ({ scope, section }: SettingRowPage): string => `${scope}:${section}`;

const PAGES: ReadonlyArray<SettingRowPage> = [
  ...new Map(
    SETTING_ROWS.filter((row) => !isRunDefaultsFocus(row.page)).map(
      (row) => [pageId(row.page), row.page] as const,
    ),
  ).values(),
];

const KEYS: ReadonlySet<string> = new Set(SETTING_ROWS.map((row) => row.key));

const UNANCHORED: ReadonlySet<string> = new Set([
  'pair-iphone',
  'your-job',
  'about-work',
  'working-rules',
  'explain-more',
]);

const BEHIND_DISCLOSURE: ReadonlySet<string> = new Set([
  'reply-template-fixed',
  'reply-template-no-change',
]);

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

const FOLDED: ReadonlySet<string> = new Set(['reply-template-fixed']);

type MountParams = {
  readonly page: SettingRowPage;
  readonly row?: string;
};

const mountPage = async ({ page, row }: MountParams): Promise<Element> => {
  const folded = SETTING_ROWS.find(
    (entry) => pageId(entry.page) === pageId(page) && FOLDED.has(entry.key),
  );
  const focusRow = row ?? folded?.key;
  const focus = focusRow === undefined ? page : { ...page, row: focusRow };
  const { container } = render(<SettingsFrame focus={focus} seed={seedPage} />);
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
  const [first, ...rest] = useAppStore.getState().sessions;
  const planRun = aWorkflowRun({ executionMode: 'dynamic' });
  useAppStore.setState({
    loadProjectGitStatus: async () => undefined,
    sessions:
      first === undefined
        ? []
        : [{ ...first, workflowRuns: [...first.workflowRuns, planRun] }, ...rest],
  });
};

describe('setting rows registry', () => {
  it.each([
    { scope: 'app', section: 'general', row: 'theme' },
    { scope: 'workspace', section: 'branches', row: 'branch-prefix' },
  ] as const)('opens $section and lights the $row row itself', async (focus) => {
    const { container } = render(<SettingsFrame focus={focus} seed={seedPage} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const lit = container.querySelector<HTMLElement>(`[data-anchor="${focus.row}"]`);
    expect(lit?.dataset.highlighted).toBe('');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
    expect(lit?.dataset.highlighted).toBeUndefined();
  });

  it.each(
    SETTING_ROWS.filter((row) => isRunDefaultsFocus(row.page)).map((row) => ({
      key: row.key,
      page: row.page,
    })),
  )('hands the $key row to Workflows, Every run', async ({ key, page }) => {
    render(<SettingsFrame focus={{ ...page, row: key }} seed={seedPage} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(useAppStore.getState().appStudio).toEqual({ kind: 'workflow' });
    expect(useAppStore.getState().workflowStudioView).toBe('every');
  });

  it('keeps every other row in Settings, in the same scope as before', () => {
    expect(
      SETTING_ROWS.filter((row) => !isRunDefaultsFocus(row.page)).map(
        (row) => `${row.key}:${row.page.scope}:${row.page.section}`,
      ),
    ).toEqual(
      expect.arrayContaining([
        'theme:app:general',
        'open-editor:app:devtools',
        'links-open:app:devtools',
        'command-status:app:devtools',
        'check-origin:app:devtools',
        'search-index:app:storage',
        'search-rebuild:app:storage',
        'search-leave-out:app:storage',
        'background-download:app:general',
        'provider-priority:workspace:models',
      ]),
    );
  });

  it('gives every row a unique key', () => {
    expect(KEYS.size).toBe(SETTING_ROWS.length);
  });

  it.each(PAGES.map((page) => ({ id: pageId(page), page })))(
    'renders every registry row of $id, and every rendered row is in the registry',
    async ({ page }) => {
      const detail = await mountPage({ page });
      const texts = textsOf({ detail });
      const rows = SETTING_ROWS.filter((row) => pageId(row.page) === pageId(page));
      const expected = rows.filter((row) => !BEHIND_DISCLOSURE.has(row.key));

      expect(expected.filter((row) => !texts.has(row.label)).map((row) => row.key)).toEqual([]);
      const anchored = [...detail.querySelectorAll<HTMLElement>('[data-anchor]')].map(
        (node) => node.dataset.anchor ?? '',
      );
      expect(anchored.filter((key) => !KEYS.has(key))).toEqual([]);
      expect(
        expected
          .filter((row) => !UNANCHORED.has(row.key) && !anchored.includes(row.key))
          .map((row) => row.key),
      ).toEqual([]);

      for (const row of rows.filter((candidate) => BEHIND_DISCLOSURE.has(candidate.key))) {
        cleanup();
        const opened = await mountPage({ page, row: row.key });
        expect(textsOf({ detail: opened }).has(row.label)).toBe(true);
        expect(opened.querySelector(`[data-anchor="${row.key}"]`)).not.toBeNull();
      }
    },
  );
});
