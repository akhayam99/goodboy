// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { harborline, seedColumn, sessionOf } from '../../workspace/testing/sessionColumn';
import {
  PRELOAD_BACKOFF_MS,
  PRELOAD_MAX_TRIES,
  preloadSessionDetail,
  resetPreloadSessionDetail,
} from './preloadSessionDetail';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const session = sessionOf({ goal: 'Retry window for the webhook' });

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const T0 = Date.parse('2026-10-05T09:00:00.000Z');

const runAt = async ({ now }: { readonly now: number }): Promise<void> => {
  vi.setSystemTime(now);
  preloadSessionDetail({ state: useAppStore.getState(), now });
  await flush();
};

beforeEach(async () => {
  vi.useFakeTimers();
  resetPreloadSessionDetail();
  await resetStoryStore();
  seedColumn({ store: useAppStore, sessions: [session], questions: [session], mounts: [] });
  useAppStore.setState({ workspaces: [harborline] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('preloadSessionDetail', () => {
  it('retries a load that failed after the backoff and stops once it landed', async () => {
    const loadArtifacts = vi
      .fn<(id: string) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(async (id) => {
        useAppStore.setState((state) => ({
          sessionArtifacts: { ...state.sessionArtifacts, [id]: [] },
        }));
      });
    useAppStore.setState({
      loadSessionArtifacts: loadArtifacts,
      loadSessionAnsweredQuestions: async () => undefined,
      sessionAnsweredQuestions: { [session.id]: [] },
    });

    await runAt({ now: T0 });
    expect(loadArtifacts).toHaveBeenCalledTimes(1);

    await runAt({ now: T0 + PRELOAD_BACKOFF_MS - 1 });
    expect(loadArtifacts).toHaveBeenCalledTimes(1);

    await runAt({ now: T0 + PRELOAD_BACKOFF_MS });
    expect(loadArtifacts).toHaveBeenCalledTimes(2);

    await runAt({ now: T0 + 10 * PRELOAD_BACKOFF_MS });
    expect(loadArtifacts).toHaveBeenCalledTimes(2);
  });

  it('gives up after the bounded number of tries', async () => {
    const loadArtifacts = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
    useAppStore.setState({
      loadSessionArtifacts: loadArtifacts,
      loadSessionAnsweredQuestions: async () => undefined,
      sessionAnsweredQuestions: { [session.id]: [] },
    });

    for (let step = 0; step < PRELOAD_MAX_TRIES + 3; step += 1) {
      await runAt({ now: T0 + step * 1000 * PRELOAD_BACKOFF_MS });
    }

    expect(loadArtifacts).toHaveBeenCalledTimes(PRELOAD_MAX_TRIES);
  });

  it('does not start a second load while the first one is running', async () => {
    let finish: () => void = () => undefined;
    const loadArtifacts = vi.fn<(id: string) => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    useAppStore.setState({
      loadSessionArtifacts: loadArtifacts,
      loadSessionAnsweredQuestions: async () => undefined,
      sessionAnsweredQuestions: { [session.id]: [] },
    });

    await runAt({ now: T0 });
    await runAt({ now: T0 + 100 * PRELOAD_BACKOFF_MS });
    finish();

    expect(loadArtifacts).toHaveBeenCalledTimes(1);
  });
});
