// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { SESSION_PAGE_INTRO } from '../../../../../features/session/sessionPageIntro';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U31_PAGES_SCENES } from './pages';

const WAIT = { timeout: 15_000 };

type SceneName = keyof typeof U31_PAGES_SCENES;

beforeAll(async () => {
  installFakeResizeObserver();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = ({ name }: { readonly name: SceneName }) => {
  const Scene = U31_PAGES_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const SCENE_NAMES: ReadonlyArray<SceneName> = ['u31-overview', 'u31-runs', 'u31-runs-run'];

describe('the u31 pages scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U31_PAGES_SCENES)).toEqual(SCENE_NAMES);
    for (const name of SCENE_NAMES) {
      expect(MOCK_SCENES[name]).toBe(U31_PAGES_SCENES[name]);
    }
  });

  it.each(SCENE_NAMES)(
    '%s frames the capture on one 680px element whose padding sits on an inner element',
    async (name) => {
      const { container } = mount({ name });

      await waitFor(() => expect(container.querySelectorAll('[data-shot]')).toHaveLength(1), WAIT);
      const frame = container.querySelector<HTMLElement>('[data-shot]');
      expect(frame?.style.width).toBe('680px');
      expect(frame?.style.padding).toBe('');
      expect(frame?.children).toHaveLength(1);
    },
  );

  it('u31-overview names its cards over their rows, with Full log as a quiet button', async () => {
    const { container } = mount({ name: 'u31-overview' });

    await screen.findByText('Waiting for you', undefined, WAIT);
    const labels = [
      ...container.querySelectorAll<HTMLElement>('[data-overview-card] [data-section-label]'),
    ];
    expect(labels.map((item) => item.textContent)).toEqual(['Waiting for you', 'Done']);
    expect(screen.getByRole('button', { name: 'Full log' }).dataset.variant).toBe('quiet');
  });

  it('u31-runs groups the runs under level 2 headings, one title and the facts after it', async () => {
    const { container } = mount({ name: 'u31-runs' });

    await screen.findByRole('heading', { level: 2, name: 'In progress' }, WAIT);
    screen.getByRole('heading', { level: 2, name: 'Finished' });
    const rows = [...container.querySelectorAll<HTMLElement>('[data-list-grid-row]')];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelectorAll('[data-list-grid-cell="title"]')).toHaveLength(1);
      expect(row.querySelectorAll('[data-list-grid-cell="word"]')).toHaveLength(1);
    }
  });

  it('u31-runs leads with one lede line under the title', async () => {
    const { container } = mount({ name: 'u31-runs' });

    await screen.findByRole('heading', { level: 2, name: 'In progress' }, WAIT);
    const intro = container.querySelector<HTMLElement>('[data-slot="session-page-intro"]');
    expect([...(intro?.querySelectorAll('p') ?? [])].map((line) => line.textContent)).toEqual([
      ...SESSION_PAGE_INTRO.runs,
    ]);
  });

  it('u31-runs-run names the Steps and lists every step under it', async () => {
    const { container } = mount({ name: 'u31-runs-run' });

    await screen.findByRole('heading', { level: 2, name: 'Steps' }, WAIT);
    const steps = container.querySelectorAll('[data-checklist-cell="step"]');
    expect(steps.length).toBeGreaterThan(0);
    const section = screen.getByRole('region', { name: 'Plan and progress' });
    within(section).getByRole('heading', { level: 2, name: 'Steps' });
  });
});
