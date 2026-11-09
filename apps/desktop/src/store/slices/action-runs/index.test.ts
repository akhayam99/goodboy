// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { selectActionRun } from './selectActionRun';

vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);

const PR_KEY = 'pullRequest:session-harborline:mount-payments-api';
const DIFF_KEY = 'diff:session-harborline:/work/payments-api';

type Gate = {
  readonly promise: Promise<string | null>;
  readonly resolve: (value: string | null) => void;
  readonly reject: (error: Error) => void;
};

const gate = (): Gate => {
  let resolve: (value: string | null) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<string | null>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

type RunOfParams = {
  readonly key: string;
};

const runOf = ({ key }: RunOfParams) => selectActionRun({ state: store.getState(), key });

describe('action runs', () => {
  it('holds one pending run per target and refuses a second claim until it settles', async () => {
    const first = gate();
    const task = vi.fn(() => first.promise);
    const running = store
      .getState()
      .runAction({ key: PR_KEY, actionId: 'pullRequest.merge', choice: 'squash', task });

    expect(runOf({ key: PR_KEY })).toMatchObject({
      phase: 'pending',
      actionId: 'pullRequest.merge',
      choice: 'squash',
    });
    await expect(
      store
        .getState()
        .runAction({ key: PR_KEY, actionId: 'pullRequest.close', choice: null, task }),
    ).resolves.toBe('busy');
    expect(task).toHaveBeenCalledTimes(1);

    first.resolve('Merged #318 into main.');
    await expect(running).resolves.toBe('applied');
    expect(runOf({ key: PR_KEY })).toMatchObject({
      phase: 'done',
      message: 'Merged #318 into main.',
    });
  });

  it('keeps targets apart: a run on one target never touches another', async () => {
    const pr = gate();
    void store.getState().runAction({
      key: PR_KEY,
      actionId: 'pullRequest.merge',
      choice: null,
      task: () => pr.promise,
    });

    await store.getState().runAction({
      key: DIFF_KEY,
      actionId: 'diff.push',
      choice: null,
      task: async () => 'Pushed 2 commits.',
    });

    expect(runOf({ key: DIFF_KEY })?.phase).toBe('done');
    expect(runOf({ key: PR_KEY })?.phase).toBe('pending');
  });

  it('keeps the failure in place with its message and choice, and a new claim replaces it', async () => {
    await store.getState().runAction({
      key: PR_KEY,
      actionId: 'pullRequest.merge',
      choice: 'rebase',
      task: async () => {
        throw new Error('Base branch was modified');
      },
    });

    expect(runOf({ key: PR_KEY })).toMatchObject({
      phase: 'failed',
      message: 'Base branch was modified',
      choice: 'rebase',
    });

    const retry = gate();
    void store.getState().runAction({
      key: PR_KEY,
      actionId: 'pullRequest.merge',
      choice: 'rebase',
      task: () => retry.promise,
    });
    expect(runOf({ key: PR_KEY })?.phase).toBe('pending');
    retry.resolve(null);
  });

  it('leaves nothing behind when the task finishes with nothing to say', async () => {
    await store.getState().runAction({
      key: PR_KEY,
      actionId: 'pullRequest.openOnGithub',
      choice: null,
      task: async () => null,
    });

    expect(runOf({ key: PR_KEY })).toBeNull();
  });

  it('drops a late answer once its run was dropped, even if a new run took the key', async () => {
    const old = gate();
    const late = store.getState().runAction({
      key: PR_KEY,
      actionId: 'pullRequest.close',
      choice: null,
      task: () => old.promise,
    });
    store.getState().dropActionRun({ key: PR_KEY });

    const fresh = gate();
    void store.getState().runAction({
      key: PR_KEY,
      actionId: 'pullRequest.reopen',
      choice: null,
      task: () => fresh.promise,
    });
    old.reject(new Error('late failure'));

    await expect(late).resolves.toBe('stale');
    expect(runOf({ key: PR_KEY })).toMatchObject({
      phase: 'pending',
      actionId: 'pullRequest.reopen',
    });
    fresh.resolve(null);
  });

  it('dismisses a finished line but never a pending run', async () => {
    const pending = gate();
    void store.getState().runAction({
      key: PR_KEY,
      actionId: 'pullRequest.merge',
      choice: null,
      task: () => pending.promise,
    });

    store.getState().dismissActionRun({ key: PR_KEY });
    expect(runOf({ key: PR_KEY })?.phase).toBe('pending');

    pending.resolve('Merged #318 into main.');
    await vi.waitFor(() => expect(runOf({ key: PR_KEY })?.phase).toBe('done'));
    store.getState().dismissActionRun({ key: PR_KEY });
    expect(runOf({ key: PR_KEY })).toBeNull();
  });
});
