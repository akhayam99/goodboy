// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { stageInfosOf } from '../../../../../store/slices/session-view/stageInfosOf';
import { needsYouOf } from '../../../../../features/board/needsYou/needsYouOf';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U50_NAV_DOCS_SCENES } from './navDocs';

let useAppStore: StoryStore;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
  resetWorktreeStatusCache();
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

type SceneParams = {
  readonly name: string;
};

type TitleParams = {
  readonly title: string;
};

const DESK_TITLE = 'Nightly reconciliation before the Monday close';
const ASKING_TITLE = 'Fix the rounding drift in the settlement export';

const renderScene = ({ name }: SceneParams) => {
  const Scene = U50_NAV_DOCS_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`No scene ${name}`);
  }
  render(<Scene />);
};

const rowOf = async ({ title }: TitleParams): Promise<HTMLElement> => {
  const sessions = await screen.findByRole('dialog', { name: 'Sessions' });
  const row = within(sessions)
    .getAllByRole('option')
    .find((option) => option.textContent?.includes(title) === true);
  if (row === undefined) {
    throw new Error(`No Sessions row for ${title}`);
  }
  return row;
};

const queueCountOf = ({ title }: TitleParams): number => {
  const state = useAppStore.getState();
  const session = state.sessions.find((candidate) => candidate.goal === title);
  if (session === undefined) {
    throw new Error(`No session ${title}`);
  }
  return needsYouOf({
    sessions: [session],
    infos: stageInfosOf({ state, sessions: [session] }),
    openQuestions: { [session.id]: state.sessionOpenQuestions[session.id] ?? [] },
  }).moveCount;
};

describe('the u50 nav docs scenes', () => {
  it('lists the scene in light and dark', () => {
    expect(Object.keys(U50_NAV_DOCS_SCENES)).toEqual(['u50-nav-docs-light', 'u50-nav-docs-dark']);
  });

  it('opens Sessions with a row for each session and no face label', async () => {
    renderScene({ name: 'u50-nav-docs-light' });
    const row = await rowOf({ title: DESK_TITLE });

    expect(row.querySelector('[data-sessions-face]')).toBeNull();
  });

  it('counts what waits on you in a row with the Queue number', async () => {
    renderScene({ name: 'u50-nav-docs-dark' });
    const row = await rowOf({ title: ASKING_TITLE });
    const count = queueCountOf({ title: ASKING_TITLE });

    expect(count).toBeGreaterThan(0);
    expect(within(row).getByTestId('sessions-needs-you').textContent).toBe(String(count));
    expect(row.querySelector('[data-sessions-face]')).toBeNull();
  });
});
