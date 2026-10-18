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

const RUN_SCENES = [
  'header-run',
  'workflow-run',
  'workflow-run-finished-sets',
  'workflow-run-nested',
  'workflow-run-plan-question',
  'workflow-run-plan-review',
  'workflow-run-scrolled',
  'workflow-run-step-question',
  'run-header-held',
  'run-header-paused',
  'run-header-failed',
  'run-header-archived',
] as const;

const ONE_H1_SCENES: ReadonlyArray<string> = [
  'workflow-studio',
  'inbox-states',
  'impact-scopes',
  ...STUDIO_SCENES,
  ...RUN_SCENES,
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

  it.each([
    ['frame-studio-inbox', false],
    ['frame-studio-workflows', false],
    ['frame-studio-impact', false],
    ['frame-studio-guide', true],
  ] as const)('draws no band around %s, its title alone on the column', async (id, hasClose) => {
    const { container } = await renderScene(id);

    await waitFor(() => expect(visibleH1s()).toHaveLength(1));
    expect(container.querySelector('[data-studio-band]')).toBeNull();
    const header = visibleH1s()[0]?.closest('[data-slot="pane-header"]');
    expect(visibleH1s()[0]?.closest('[data-page-column]')?.getAttribute('data-width')).toBe(
      'column',
    );
    expect(header?.hasAttribute('data-under-trail')).toBe(false);
    expect(
      screen
        .queryAllByRole('button', { name: /^Close/ })
        .filter((button) => header?.contains(button) === true),
    ).toHaveLength(hasClose ? 1 : 0);
  });

  it('gives Workflows its title and the tab strip with its one primary under it', async () => {
    await renderScene('frame-studio-workflows');

    const title = await screen.findByRole('heading', { level: 1, name: 'Workflows' });
    const tabs = screen.getByRole('tablist', { name: 'Workflows and saved steps' });
    expect(title.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'New workflow' })).toHaveLength(1);
  });

  it('keeps the Impact period selector in the title row of its bandless page', async () => {
    const { container } = await renderScene('frame-studio-impact');

    const title = await screen.findByRole('heading', { level: 1, name: 'Impact' });
    const row = title.closest('[data-slot="pane-title-row"]') as HTMLElement;
    expect(within(row).getByRole('tablist', { name: 'Impact window' })).toBeDefined();
    expect(container.querySelector('[data-studio-band]')).toBeNull();
  });

  it('puts the Questions list under the title in one column', async () => {
    await renderScene('frame-questions');

    const title = await screen.findByRole('heading', { level: 1, name: 'Questions' });
    const column = title.closest('[data-page-column]') as HTMLElement;
    expect(column.getAttribute('data-width')).toBe('column');
    const queue = await screen.findByRole('list', { name: 'Questions' });
    const bodyColumn = queue.closest('[data-page-column]') as HTMLElement;
    expect(bodyColumn.getAttribute('data-width')).toBe('column');
    expect(within(bodyColumn).getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-page-column][data-width="measure"]')).toHaveLength(0);
  });

  it('shows the first lap as one notice in the Overview notices, under the title', async () => {
    await renderScene('frame-first-lap-notice');

    const notice = await screen.findByText('Not published yet');
    const slot = notice.closest('[data-overview-notices]') as HTMLElement;
    expect(slot).not.toBeNull();
    const title = visibleH1s()[0] as HTMLElement;
    expect(title.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText(/[Pp]ublished yet/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('puts no action in the Commits tab row and no legend', async () => {
    await renderScene('branch-commits-toolbar');

    await screen.findByRole('list', { name: 'Commits' }, { timeout: 4_000 });
    expect(screen.queryByRole('button', { name: 'Backups' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open terminal here' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More history actions' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Legend' })).toBeNull();
  });
});
