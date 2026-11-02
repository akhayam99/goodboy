// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { MOCK_SCENES } from '../..';
import { WORKSPACE_ID } from '../BoardScene';
import { LANE_WINDOW_ARCHIVED, LANE_WINDOW_DONE } from './seedLaneWindowBoard';
import { U34_T26_SCENES } from './t26';

let useAppStore: StoryStore;

beforeAll(async () => {
  installFakeResizeObserver();
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
});

afterEach(cleanup);

type MountParams = { readonly name: keyof typeof U34_T26_SCENES };
const mount = ({ name }: MountParams) => {
  const Scene = U34_T26_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u34 t26 scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(MOCK_SCENES['u34-t26-pr-slot']).toBe(U34_T26_SCENES['u34-t26-pr-slot']);
    expect(MOCK_SCENES['u34-t26-lane-window']).toBe(U34_T26_SCENES['u34-t26-lane-window']);
  });

  it('draws the board cards while no pull request has answered yet', async () => {
    mount({ name: 'u34-t26-pr-slot' });

    expect(await screen.findByRole('group', { name: 'done' })).toBeDefined();
    expect(Object.keys(useAppStore.getState().sessionGithub)).toHaveLength(0);
    expect(useAppStore.getState().boardReady).toBe(true);
  });

  it('windows the Done lane to fifty cards and offers the rest', async () => {
    mount({ name: 'u34-t26-lane-window' });

    const lane = await screen.findByRole('group', { name: 'done' });
    expect(lane.querySelectorAll('article[data-select-id]')).toHaveLength(50);
    const archivedLane = screen.getByRole('group', { name: 'archived' });
    expect(archivedLane.querySelectorAll('article[data-select-id]')).toHaveLength(50);
    expect(screen.getAllByRole('button', { name: /Show \d+ more/ })).toHaveLength(2);
    expect(useAppStore.getState().archivedSessions[WORKSPACE_ID]).toHaveLength(
      LANE_WINDOW_ARCHIVED,
    );
  });
});
