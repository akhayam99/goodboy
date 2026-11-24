// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../../..';
import { TASKS_SOURCE_FAILURE_SCENES } from './source-failure';

const WAIT = { timeout: 15_000 };

type MountParams = {
  readonly id: string;
};

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

const mount = ({ id }: MountParams) => {
  const Scene = TASKS_SOURCE_FAILURE_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the tasks source failure scenes', () => {
  it('registers the light and dark scenes', () => {
    expect(Object.keys(TASKS_SOURCE_FAILURE_SCENES).sort()).toEqual([
      'tasks-source-failure',
      'tasks-source-failure-dark',
    ]);
    for (const [id, Scene] of Object.entries(TASKS_SOURCE_FAILURE_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it.each(['tasks-source-failure', 'tasks-source-failure-dark'])(
    'draws the refused Sentry notice inside the Sentry group, under its title (%s)',
    async (id) => {
      mount({ id });

      const heading = await screen.findByRole('heading', { name: 'Sentry' }, WAIT);
      const group = heading.closest('li');
      const failure = document.querySelector('[data-task-failure="sentry"]');
      if (group === null || failure === null) {
        throw new Error('The Sentry group or its notice is not drawn.');
      }
      expect(group.contains(failure)).toBe(true);
      expect(heading.compareDocumentPosition(failure) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(failure.textContent).toContain('Sentry refused the token');
    },
  );
});
