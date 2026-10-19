// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../store/slices/worktreeStatuses/cache';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { SETTING_OVERVIEW_LAYOUT } from '../../../settings/settings';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
} from '../../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('./index').SessionOverviewPane;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
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

afterEach(cleanup);

type MountParams = {
  readonly layout: string | null;
};

const mount = async ({ layout }: MountParams) => {
  seedCentralColumn({ kind: 'mid' });
  useAppStore.setState((state) => {
    const { [SETTING_OVERVIEW_LAYOUT]: _dropped, ...rest } = state.settings;
    return { settings: layout === null ? rest : { ...rest, [SETTING_OVERVIEW_LAYOUT]: layout } };
  });
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  render(
    <ToastProvider>
      <AutoReleaseContext.Provider value>
        <SessionOverviewPane session={session} onSelectLens={vi.fn()} />
      </AutoReleaseContext.Provider>
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
};

const isNewColumn = (): boolean => document.querySelector('[data-central-column]') !== null;

describe('the session overview layout', () => {
  it('renders Classic when nothing is stored, with the view toggle in the header', async () => {
    await mount({ layout: null });

    expect(isNewColumn()).toBe(false);
    expect(screen.getByRole('region', { name: 'Activity' })).toBeDefined();
    expect(screen.getByRole('tablist', { name: 'Overview' })).toBeDefined();
  });

  it('renders Classic when the stored value is classic', async () => {
    await mount({ layout: 'classic' });

    expect(isNewColumn()).toBe(false);
    expect(screen.getByRole('region', { name: 'Activity' })).toBeDefined();
  });

  it('renders the new column and the view toggle when the setting is new', async () => {
    await mount({ layout: 'new' });

    expect(isNewColumn()).toBe(true);
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Overview' })).toBeDefined();
  });

  it('swaps a window open on Classic to the new column when the setting flips', async () => {
    await mount({ layout: 'classic' });

    await act(async () => {
      useAppStore.setState((state) => ({
        settings: { ...state.settings, [SETTING_OVERVIEW_LAYOUT]: 'new' },
      }));
    });

    expect(isNewColumn()).toBe(true);
  });
});
