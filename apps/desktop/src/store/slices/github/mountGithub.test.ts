// @vitest-environment node
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { applyMountGithub } from './mountGithub';
import { aMountGithub } from './testing/aMountGithub';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const SESSION_ID = brandId<SessionId>({ value: 'session-payments' });
const FIRST = brandId<MountId>({ value: 'mount-first' });
const SECOND = brandId<MountId>({ value: 'mount-second' });

describe('applyMountGithub', () => {
  it('copies the map once for a write and puts the new value under its mount', () => {
    const first = aMountGithub({ mountId: FIRST });
    const before = store.getState();

    const write = applyMountGithub({
      state: before,
      sessionId: SESSION_ID,
      mountId: FIRST,
      github: first,
    });

    expect(write.mountGithub).not.toBe(before.mountGithub);
    expect(write.mountGithub[FIRST]).toBe(first);
  });

  it('keeps the other mounts of the map as they were', () => {
    const first = aMountGithub({ mountId: FIRST });
    store.setState({ mountGithub: { [FIRST]: first } });

    const write = applyMountGithub({
      state: store.getState(),
      sessionId: SESSION_ID,
      mountId: SECOND,
      github: aMountGithub({ mountId: SECOND }),
    });

    expect(write.mountGithub[FIRST]).toBe(first);
  });

  it('returns the same map when the same value is written again', () => {
    const first = aMountGithub({ mountId: FIRST });
    store.setState({ mountGithub: { [FIRST]: first } });
    const before = store.getState();

    const write = applyMountGithub({
      state: before,
      sessionId: SESSION_ID,
      mountId: FIRST,
      github: first,
    });

    expect(write.mountGithub).toBe(before.mountGithub);
  });

  it('returns the same map when only the selected pull request is written', () => {
    const first = aMountGithub({ mountId: FIRST });
    store.setState({ mountGithub: { [FIRST]: first } });
    const before = store.getState();

    const write = applyMountGithub({
      state: before,
      sessionId: SESSION_ID,
      mountId: FIRST,
      selected: null,
    });

    expect(write.mountGithub).toBe(before.mountGithub);
  });

  it('returns the same map when a mount that is not there is cleared', () => {
    const before = store.getState();

    const write = applyMountGithub({
      state: before,
      sessionId: SESSION_ID,
      mountId: FIRST,
      github: null,
    });

    expect(write.mountGithub).toBe(before.mountGithub);
  });

  it('removes a mount that is there when it is cleared', () => {
    store.setState({
      mountGithub: { [FIRST]: aMountGithub({ mountId: FIRST }) },
    });

    const write = applyMountGithub({
      state: store.getState(),
      sessionId: SESSION_ID,
      mountId: FIRST,
      github: null,
    });

    expect(write.mountGithub[FIRST]).toBeUndefined();
  });
});
