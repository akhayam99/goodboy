// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { registerMockFixtures } from '../../../../../shared/lib/mockFixtures';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { captureLocation } from '../../../../../store/slices/navigation/captureLocation';
import { branchPlace } from '../../../../../store/slices/navigation/place';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { MOCK_SCENES } from '../..';
import { mockArtifactProvenance, mockMountDiffStat } from '../../mockFixtureData';
import { SESSION_ID } from '../activityRunSeed';
import { U37_BRANCH_WORK_SCENES } from './branch-work';

const SETTLE_MS = 2_000;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  registerMockFixtures({
    readers: { mountDiffStat: mockMountDiffStat, artifactProvenance: mockArtifactProvenance },
  });
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    if (command === 'db_select') {
      return Promise.resolve([]);
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  registerMockFixtures({
    readers: { mountDiffStat: () => null, artifactProvenance: () => null },
  });
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const mount = async (): Promise<void> => {
  const Scene = U37_BRANCH_WORK_SCENES['u37-branch-work'];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await settle();
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const sectionOf = (name: string): HTMLElement => {
  const heading = screen.getAllByRole('heading', { level: 2, name: new RegExp(`^${name}`) })[0];
  const section = heading?.closest('li') ?? heading?.closest('section') ?? null;
  if (section === null) {
    throw new Error(`missing the ${name} section`);
  }
  return section;
};

const placeOf = () => captureLocation({ state: useAppStore.getState() }).place;

const arriveOnWork = (): void => {
  useAppStore.setState({ navigate: useAppStore.getInitialState().navigate });
  const mountPath = useAppStore.getState().sessionMounts[SESSION_ID]?.[0]?.worktreePath ?? null;
  act(() =>
    useAppStore
      .getState()
      .navigate({ to: branchPlace({ sessionId: SESSION_ID, mountPath, tab: 'work' }) }),
  );
};

describe('the u37 branch work scene', () => {
  it('registers the scene in the mock registry', () => {
    expect(MOCK_SCENES['u37-branch-work']).toBeDefined();
  });

  it('opens on Work with runs, questions and artifacts of the branch, and the line under the tabs gone', async () => {
    await mount();

    const strip = screen.getByRole('tablist', { name: 'Branch pages' });
    const work = within(strip).getByRole('tab', { name: /^Work/ });
    expect(work.getAttribute('aria-selected')).toBe('true');
    expect(work.querySelector('[data-tab-count]')?.textContent).toBe('1');
    expect(document.querySelector('[data-branch-runs-line]')).toBeNull();
    sectionOf('Runs');
    within(sectionOf('Questions')).getByText('Should the limit apply per endpoint or per event?');
    within(sectionOf('Artifacts')).getByText('Duplicate credit audit');
  });

  it('reads one run state in the Runs header and in its rows', async () => {
    await mount();

    const runs = sectionOf('Runs');
    expect(within(runs).getAllByText('Running')).toHaveLength(1);
    expect(within(runs).getAllByText('Needs you')).toHaveLength(1);
    expect(within(runs).queryByText('Done')).toBeNull();
    const fold = within(runs).getByRole('button', { name: '1 finished' });

    fireEvent.click(fold);

    expect(within(runs).getAllByText('Running')).toHaveLength(1);
    expect(within(runs).getAllByText('Needs you')).toHaveLength(1);
    expect(within(runs).getAllByText('Done')).toHaveLength(1);
    within(runs).getByRole('button', { name: 'Hide finished' });
  });

  it('goes Back from a run opened on Work to the Work tab', async () => {
    await mount();
    arriveOnWork();

    fireEvent.click(
      within(sectionOf('Runs')).getByRole('button', { name: /^Open Fix duplicate credit/ }),
    );
    const away = placeOf();
    expect(away.at === 'session' ? away.view.lens : null).toBe('workflows');
    expect(away.at === 'session' ? away.view.agentId : null).not.toBeNull();

    act(() => useAppStore.getState().up());

    const back = placeOf();
    expect(back.at === 'session' ? back.view.target : null).toMatchObject({
      kind: 'branch',
      tab: 'work',
    });
    expect(useAppStore.getState().branchTab[SESSION_ID]).toBe('work');
  });

  it('keeps the grouping you chose when All runs leaves for the session page', async () => {
    useAppStore.setState({ groupBySession: { [SESSION_ID]: 'state' } });
    await mount();
    arriveOnWork();

    fireEvent.click(within(sectionOf('Runs')).getByRole('button', { name: 'All runs' }));

    expect(useAppStore.getState().groupBySession[SESSION_ID]).toBe('state');
    const runs = placeOf();
    expect(runs.at === 'session' ? runs.view.lens : null).toBe('workflows');

    act(() => useAppStore.getState().up());

    expect(useAppStore.getState().branchTab[SESSION_ID]).toBe('work');
  });
});
