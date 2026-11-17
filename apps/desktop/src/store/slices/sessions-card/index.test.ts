// @vitest-environment happy-dom
const { getSettingMock, setSettingMock } = vi.hoisted(() => ({
  getSettingMock: vi.fn<(db: unknown, key: string) => Promise<string | null>>(async () => null),
  setSettingMock: vi.fn(async (_db: unknown, _key: string, _value: string) => undefined),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { SETTING_SESSIONS_CARD_CLOSED } from './state';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type StoredParams = {
  readonly closed: string | null;
};

const storeWith = ({ closed }: StoredParams): void => {
  getSettingMock.mockImplementation(async (_db, key) =>
    key === SETTING_SESSIONS_CARD_CLOSED ? closed : null,
  );
};

const phase = () => useAppStore.getState().sessionsCardPhase;

beforeEach(async () => {
  await resetStoryStore();
  getSettingMock.mockReset();
  setSettingMock.mockReset();
  setSettingMock.mockResolvedValue(undefined);
  storeWith({ closed: null });
  useAppStore.setState({ reportError: vi.fn(async () => undefined) });
});

describe('the one-time Sessions card', () => {
  it('opens for an update that has seen a release before', async () => {
    useAppStore.setState({ changelogSeenVersion: '0.39.1' });
    await useAppStore.getState().hydrateSessionsCard();
    expect(phase()).toBe('open');
  });

  it('stays closed on a fresh install and saves that it is closed', async () => {
    useAppStore.setState({ changelogSeenVersion: null });
    await useAppStore.getState().hydrateSessionsCard();
    expect(phase()).toBe('closed');
    expect(setSettingMock).toHaveBeenCalledWith(
      expect.anything(),
      SETTING_SESSIONS_CARD_CLOSED,
      '1',
    );
  });

  it('stays closed once the close was saved', async () => {
    storeWith({ closed: '1' });
    useAppStore.setState({ changelogSeenVersion: '0.39.1' });
    await useAppStore.getState().hydrateSessionsCard();
    expect(phase()).toBe('closed');
  });

  it('closes for good after the save lands', async () => {
    useAppStore.setState({ changelogSeenVersion: '0.39.1' });
    await useAppStore.getState().hydrateSessionsCard();
    await useAppStore.getState().closeSessionsCard();
    expect(phase()).toBe('closed');
    expect(setSettingMock).toHaveBeenCalledWith(
      expect.anything(),
      SETTING_SESSIONS_CARD_CLOSED,
      '1',
    );
  });

  it('keeps the card and reports the error when the save fails, then retries', async () => {
    useAppStore.setState({ changelogSeenVersion: '0.39.1' });
    await useAppStore.getState().hydrateSessionsCard();
    setSettingMock.mockRejectedValueOnce(new Error('disk full'));
    await useAppStore.getState().closeSessionsCard();
    expect(phase()).toBe('open');
    expect(useAppStore.getState().reportError).toHaveBeenCalledTimes(1);
    await useAppStore.getState().closeSessionsCard();
    expect(phase()).toBe('closed');
  });

  it('saves once when two opens ask at the same time', async () => {
    useAppStore.setState({ changelogSeenVersion: '0.39.1' });
    await useAppStore.getState().hydrateSessionsCard();
    await Promise.all([
      useAppStore.getState().closeSessionsCard(),
      useAppStore.getState().closeSessionsCard(),
    ]);
    expect(setSettingMock).toHaveBeenCalledTimes(1);
  });

  it('closes when another window saved the close, on the next read', async () => {
    useAppStore.setState({ changelogSeenVersion: '0.39.1' });
    await useAppStore.getState().hydrateSessionsCard();
    storeWith({ closed: '1' });
    await useAppStore.getState().hydrateSessionsCard();
    expect(phase()).toBe('closed');
  });

  it('never reopens from a read that answers after the close', async () => {
    useAppStore.setState({ changelogSeenVersion: '0.39.1', sessionsCardPhase: 'open' });
    let release: (value: string | null) => void = () => undefined;
    getSettingMock.mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          release = resolve;
        }),
    );
    const read = useAppStore.getState().hydrateSessionsCard();
    await useAppStore.getState().closeSessionsCard();
    release(null);
    await read;
    expect(phase()).toBe('closed');
  });

  it('hides the card when the read fails', async () => {
    getSettingMock.mockRejectedValue(new Error('locked'));
    await useAppStore.getState().hydrateSessionsCard();
    expect(phase()).toBe('closed');
  });
});
