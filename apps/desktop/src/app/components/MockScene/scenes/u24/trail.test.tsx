// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_TRAIL_SCENES } from './trail';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
});

const LAST_CRUMB_OF = {
  'trail-run': 'Run',
  'trail-artifact': 'Artifact',
  'trail-agent': 'Agent',
  'trail-artifact-create': 'New artifact',
} as const;

const SCENE_IDS = [
  'trail-run',
  'trail-artifact',
  'trail-agent',
  'trail-artifact-create',
] as const satisfies ReadonlyArray<keyof typeof LAST_CRUMB_OF>;

const renderScene = (id: keyof typeof LAST_CRUMB_OF) => {
  const Scene = U24_TRAIL_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the trail scenes', () => {
  it('registers the four scenes in the scene list', () => {
    expect(Object.keys(U24_TRAIL_SCENES).sort()).toEqual([...SCENE_IDS].sort());
    for (const id of SCENE_IDS) {
      expect(MOCK_SCENES[id]).toBe(U24_TRAIL_SCENES[id]);
    }
  });

  it.each(SCENE_IDS)('ends the trail on the kind in %s and draws no back glyph', async (id) => {
    renderScene(id);

    const trail = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    const crumbs = Array.from(trail.querySelectorAll('[data-trail-segment]'));
    expect(crumbs.at(-1)?.textContent).toContain(LAST_CRUMB_OF[id]);
    expect(trail.querySelector('.lucide-chevron-left, .lucide-arrow-left')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
