// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U27_BREADCRUMBS_SCENES } from './breadcrumbs';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U27_BREADCRUMBS_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('breadcrumbs scenes', () => {
  it('registers a light and a dark after scene per place', () => {
    for (const [name, Scene] of Object.entries(U27_BREADCRUMBS_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
    expect(Object.keys(U27_BREADCRUMBS_SCENES)).toHaveLength(10);
  });

  it.each<readonly [string, string]>([
    ['run', 'Back to runs'],
    ['step', 'Back to run'],
    ['agent', 'Back to runs'],
    ['artifact', 'Back to artifacts'],
    ['branch-file', 'Back to branch'],
  ])('draws one back row and no trail on the %s page', async (slug, label) => {
    mount({ id: `u27-breadcrumbs-after-${slug}-light` });
    const back = await screen.findByRole('button', { name: label });

    expect(back.closest('[data-session-back]')).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });
});
