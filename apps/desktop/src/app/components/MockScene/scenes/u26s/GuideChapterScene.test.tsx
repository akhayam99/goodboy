// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { clearGuideChapter } from '../../../../../features/settings/components/GuideStudio/guideChapterRequest';
import { MOCK_SCENES } from '../..';
import { U26S_GUIDE_SCENES } from './GuideChapterScene';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearGuideChapter();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U26S_GUIDE_SCENES;

const SCENE_IDS: ReadonlyArray<SceneId> = [
  'u26s-guide-chapter',
  'u26s-guide-search',
  'u26s-guide-monitoring',
];

type MountParams = {
  readonly id: SceneId;
};

const mount = async ({ id }: MountParams): Promise<Element> => {
  const Scene = U26S_GUIDE_SCENES[id];
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

const rail = () => within(screen.getByRole('navigation', { name: 'Guide chapters' }));

describe('the secondary Guide scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U26S_GUIDE_SCENES).sort()).toEqual([
      'u26s-guide-chapter',
      'u26s-guide-monitoring',
      'u26s-guide-search',
    ]);
    Object.entries(U26S_GUIDE_SCENES).forEach(([id, Scene]) => expect(MOCK_SCENES[id]).toBe(Scene));
  });

  it('u26s-guide-chapter opens Commits on its own page in the framed studio', async () => {
    await mount({ id: 'u26s-guide-chapter' });

    expect(screen.getByRole('heading', { level: 1, name: 'Commits' })).toBeDefined();
    expect(rail().getByRole('button', { name: 'Commits' }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Close guide' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next chapter, Artifacts' })).toBeDefined();
  });

  it('u26s-guide-search lists the chapters and points that say limit', async () => {
    await mount({ id: 'u26s-guide-search' });

    const results = within(screen.getByRole('list', { name: 'Guide results' }));
    expect(results.getByRole('button', { name: 'Providers and limits, Chapter' })).toBeDefined();
    expect(results.getAllByRole('button').length).toBeGreaterThan(3);
    expect(screen.getByRole('heading', { level: 1, name: 'Commits' })).toBeDefined();
  });

  it('u26s-guide-monitoring opens the new Monitoring chapter', async () => {
    await mount({ id: 'u26s-guide-monitoring' });

    expect(screen.getByRole('heading', { level: 1, name: 'Monitoring' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open Monitoring' })).toBeDefined();
  });

  it.each(SCENE_IDS)('%s has no accessibility violation once drawn', async (id) => {
    const container = await mount({ id });
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
