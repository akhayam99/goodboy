import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { localChecksInitialState } from './state';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const MOUNT = brandId<MountId>({ value: 'mount-harbor-portal' });
const OTHER = brandId<MountId>({ value: 'mount-harbor-portal-nav' });
const AT = 1_790_000_000_000;

describe('the local check result of a branch', () => {
  it('starts empty, so a restart reads Not run until the next push', () => {
    expect(localChecksInitialState.mountLocalChecks).toEqual({});
    expect(store.getState().mountLocalChecks).toEqual({});
  });

  it('keeps a passed and a declined push per mount, the latest winning', () => {
    store.getState().recordLocalCheck({ mountId: MOUNT, answer: { error: null }, at: AT });
    store.getState().recordLocalCheck({
      mountId: OTHER,
      answer: { error: 'pre-push hook declined' },
      at: AT,
    });
    store.getState().recordLocalCheck({
      mountId: MOUNT,
      answer: { error: 'pre-push hook declined: 2 tests failed' },
      at: AT + 1,
    });

    expect(store.getState().mountLocalChecks[MOUNT]).toEqual({
      outcome: 'declined',
      at: AT + 1,
      message: 'pre-push hook declined: 2 tests failed',
    });
    expect(store.getState().mountLocalChecks[OTHER]?.outcome).toBe('declined');
  });

  it('leaves the last result alone when the push failed for another reason', () => {
    store.getState().recordLocalCheck({ mountId: MOUNT, answer: { error: null }, at: AT });
    store.getState().recordLocalCheck({
      mountId: MOUNT,
      answer: { error: 'Could not resolve host' },
      at: AT + 1,
    });

    expect(store.getState().mountLocalChecks[MOUNT]).toMatchObject({ outcome: 'passed', at: AT });
  });

  it('leaves the last result alone when a remote pre-receive hook declined the push', () => {
    store.getState().recordLocalCheck({ mountId: MOUNT, answer: { error: null }, at: AT });
    store.getState().recordLocalCheck({
      mountId: MOUNT,
      answer: { error: 'remote: pre-receive hook declined' },
      at: AT + 1,
    });

    expect(store.getState().mountLocalChecks[MOUNT]).toMatchObject({ outcome: 'passed', at: AT });
  });
});
