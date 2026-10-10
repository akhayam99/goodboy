// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { MOCK_SCENES } from '../..';
import { U23_FRAME_SCENES } from './frame';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  installFakeResizeObserver();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const SCENE_IDS = [
  'frame-studio-inbox',
  'frame-studio-workflows',
  'frame-studio-impact',
  'frame-studio-guide',
  'frame-questions',
  'frame-first-lap-notice',
  'branch-commits-toolbar',
] as const;

const STUDIO_SCENES = [
  'frame-studio-inbox',
  'frame-studio-workflows',
  'frame-studio-impact',
  'frame-studio-guide',
] as const;

const ONE_H1_SCENES: ReadonlyArray<string> = [
  'workflow-studio',
  'inbox-states',
  'impact-scopes',
  ...STUDIO_SCENES,
];

type SceneId = string;

const renderScene = async (id: SceneId) => {
  const Scene = MOCK_SCENES[id as keyof typeof MOCK_SCENES];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  const view = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  return view;
};

const visibleH1s = (): ReadonlyArray<HTMLElement> =>
  screen
    .queryAllByRole('heading', { level: 1 })
    .filter((title) => title.closest('.invisible, [inert], [hidden]') === null);

describe('the u23 frame scenes', () => {
  it('registers exactly the scenes the plan names, in the scene list', () => {
    expect(Object.keys(U23_FRAME_SCENES).sort()).toEqual([...SCENE_IDS].sort());
    for (const id of SCENE_IDS) {
      expect(MOCK_SCENES[id as keyof typeof MOCK_SCENES]).toBeDefined();
    }
  });

  it.each(ONE_H1_SCENES)('draws exactly one h1 in %s', async (id) => {
    await renderScene(id);

    await waitFor(() => expect(visibleH1s()).toHaveLength(1));
  });

  it.each(STUDIO_SCENES)('draws the band and the title of %s on the same column', async (id) => {
    const { container } = await renderScene(id);

    const band = container.querySelector('[data-studio-band]') as HTMLElement;
    expect(band).not.toBeNull();
    const bandColumn = band.querySelector('[data-page-column]') as HTMLElement;
    expect(bandColumn.getAttribute('data-width')).toBe('column');
    expect(within(bandColumn).getByRole('button', { name: /^Close/ })).toBeDefined();
    await waitFor(() => expect(visibleH1s()).toHaveLength(1));
    const title = visibleH1s()[0] as HTMLElement;
    expect(title.closest('[data-page-column]')?.getAttribute('data-width')).toBe('column');
    expect(title.closest('[data-slot="pane-header"]')?.hasAttribute('data-under-trail')).toBe(true);
  });

  it('gives Workflows its title and the tab strip with its one primary under it', async () => {
    await renderScene('frame-studio-workflows');

    const title = await screen.findByRole('heading', { level: 1, name: 'Workflows' });
    const tabs = screen.getByRole('tablist', { name: 'Workflows and saved steps' });
    expect(title.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'New workflow' })).toHaveLength(1);
  });

  it('moves the Impact period selector into the title row and keeps the band to crumb and Close', async () => {
    const { container } = await renderScene('frame-studio-impact');

    const title = await screen.findByRole('heading', { level: 1, name: 'Impact' });
    const row = title.closest('[data-slot="pane-title-row"]') as HTMLElement;
    expect(within(row).getByRole('tablist', { name: 'Impact window' })).toBeDefined();
    const band = container.querySelector('[data-studio-band]') as HTMLElement;
    expect(within(band).queryByRole('tablist')).toBeNull();
  });

  it('puts the Questions list and detail under the title in one column', async () => {
    await renderScene('frame-questions');

    const title = await screen.findByRole('heading', { level: 1, name: 'Questions' });
    const column = title.closest('[data-page-column]') as HTMLElement;
    expect(column.getAttribute('data-width')).toBe('column');
    const queue = await screen.findByRole('region', { name: 'Questions' });
    const bodyColumn = queue.closest('[data-page-column]') as HTMLElement;
    expect(bodyColumn.getAttribute('data-width')).toBe('column');
    expect(within(bodyColumn).getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-page-column][data-width="measure"]')).toHaveLength(0);
  });

  it('shows the first lap as one notice on the column, under the title', async () => {
    await renderScene('frame-first-lap-notice');

    const notice = await screen.findByText(
      /Your work is in the project folder\. Nothing is published yet\./,
    );
    const banner = notice.closest('[data-slot="pane-banner"]') as HTMLElement;
    expect(banner).not.toBeNull();
    const title = visibleH1s()[0] as HTMLElement;
    expect(title.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(banner.closest('[data-page-column]')).toBe(title.closest('[data-page-column]'));
    expect(screen.getAllByText(/Nothing is published yet/)).toHaveLength(1);
  });

  it('puts Refresh, Backups and Open terminal here in the Commits tab row, with the legend visible', async () => {
    await renderScene('branch-commits-toolbar');

    const slot = (await waitFor(() => {
      const found = document.querySelector('[data-slot="branch-tab-actions"]');
      if (found === null) {
        throw new Error('no tab row yet');
      }
      return found;
    })) as HTMLElement;
    await waitFor(() =>
      expect(within(slot).getByRole('button', { name: 'Refresh' })).toBeDefined(),
    );
    expect(within(slot).getByRole('button', { name: 'Backups' })).toBeDefined();
    expect(within(slot).getByRole('button', { name: 'Open terminal here' })).toBeDefined();
    expect(within(slot).queryByRole('button', { name: 'More history actions' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Legend' })).toBeDefined();
  });
});
