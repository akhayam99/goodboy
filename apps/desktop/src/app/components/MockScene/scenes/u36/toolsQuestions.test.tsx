// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U36_TOOLS_QUESTIONS_SCENES } from './toolsQuestions';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
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
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U36_TOOLS_QUESTIONS_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u36 tools and questions scenes', () => {
  it('registers a light and a dark scene per state', () => {
    for (const [name, Scene] of Object.entries(U36_TOOLS_QUESTIONS_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
    expect(Object.keys(U36_TOOLS_QUESTIONS_SCENES)).toHaveLength(4);
  });

  it.each(['light', 'dark'])(
    'u36-p7-tools-stay-%s holds the Agents tool open beside the Runs page, with what is live',
    async (theme) => {
      mount({ id: `u36-p7-tools-stay-${theme}` });

      const panel = await screen.findByRole('region', { name: 'Agents' });
      expect(useAppStore.getState().drawer?.kind).toBe('spawned');
      within(panel).getByRole('button', { name: 'All runs' });
      await screen.findByRole('list', { name: 'Runs' });
    },
  );

  it.each(['light', 'dark'])(
    'u36-p8-question-%s opens the question from its address with Recommended picked',
    async (theme) => {
      mount({ id: `u36-p8-question-${theme}` });

      const card = await screen.findByRole('article');
      expect(useAppStore.getState().drawer?.kind).toBe('question');
      const picked = within(card)
        .getAllByRole('radio')
        .filter((radio) => radio.getAttribute('aria-checked') === 'true');
      expect(picked.map((radio) => radio.getAttribute('aria-label'))).toEqual([
        'Dedicated retry queue',
      ]);
      within(card).getByRole('button', { name: 'More' });
      expect(screen.getByRole('button', { name: /^Open the agent: / }).textContent).toBe(
        'Implementer',
      );
    },
  );
});
