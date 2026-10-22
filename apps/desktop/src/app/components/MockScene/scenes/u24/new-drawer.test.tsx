// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_NEW_DRAWER_SCENES } from './new-drawer';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const WAIT = { timeout: 4_000 };

type SceneId = keyof typeof U24_NEW_DRAWER_SCENES;

type Params = { readonly id: SceneId };

const SCENE_FORM: Readonly<Record<SceneId, string>> = {
  'new-drawer-write': 'Write a report',
  'new-drawer-write-wireframe': 'Draw a wireframe',
  'new-drawer-narrow': 'Write a report',
};

const SCENE_IDS: ReadonlyArray<SceneId> = [
  'new-drawer-write',
  'new-drawer-write-wireframe',
  'new-drawer-narrow',
];

const show = ({ id }: Params) => {
  const Scene = U24_NEW_DRAWER_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const drawer = async ({ id }: Params) =>
  within(await screen.findByRole('region', { name: SCENE_FORM[id] }));

describe('the New drawer scenes', () => {
  it('registers every state', () => {
    for (const id of SCENE_IDS) {
      expect(MOCK_SCENES[id]).toBe(U24_NEW_DRAWER_SCENES[id]);
    }
  });

  it('opens the report form with no format tabs', async () => {
    show({ id: 'new-drawer-write' });

    const inDrawer = await drawer({ id: 'new-drawer-write' });
    expect(inDrawer.getByTestId('artifact-brief')).toBeDefined();
    expect(inDrawer.queryByRole('tablist', { name: 'Write format' })).toBeNull();
  });

  it('opens the wireframe form', async () => {
    show({ id: 'new-drawer-write-wireframe' });

    const inDrawer = await drawer({ id: 'new-drawer-write-wireframe' });
    expect(inDrawer.queryByText('A wireframe drawn from this session.')).toBeNull();
  });

  it('stays an overlay at 1100 px', async () => {
    show({ id: 'new-drawer-narrow' });

    await drawer({ id: 'new-drawer-narrow' });
    expect(document.querySelector('[data-drawer-mode="overlay"]')).not.toBeNull();
    expect(document.querySelector('[data-drawer-scrim]')).not.toBeNull();
  });

  it.each(SCENE_IDS)('%s has no accessibility violations', async (id) => {
    const { container } = show({ id });
    await drawer({ id });
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
