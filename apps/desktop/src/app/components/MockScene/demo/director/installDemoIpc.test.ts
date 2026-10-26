// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { installDemoIpc } from './installDemoIpc';

type Internals = {
  invoke: (command: string, args?: Readonly<Record<string, unknown>>) => Promise<unknown>;
};

let store: StoryStore;

const internals = (): Internals => {
  const value: unknown = Reflect.get(window, '__TAURI_INTERNALS__');
  if (typeof value !== 'object' || value === null) {
    throw new Error('no demo boundary');
  }
  const invoke: unknown = Reflect.get(value, 'invoke');
  if (typeof invoke !== 'function') {
    throw new Error('no invoke');
  }
  return {
    invoke: async (command, args) => Reflect.apply(invoke, value, [command, args]),
  };
};

type SettleParams = {
  readonly promise: Promise<unknown>;
};

const settled = async ({ promise }: SettleParams): Promise<unknown> =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve('PARKED'), 20))]);

beforeAll(async () => {
  store = await importStore();
  installDemoIpc();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('the demo IPC boundary', () => {
  it('writes and reads settings locally', async () => {
    const { invoke } = internals();
    await expect(
      invoke('db_execute', {
        sql: 'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING',
        params: ['runs.routes.demo', '{}', 1],
      }),
    ).resolves.toMatchObject({ rowsAffected: 1 });
    await expect(
      invoke('db_select', {
        sql: 'SELECT * FROM settings WHERE key = ?',
        params: ['runs.routes.demo'],
      }),
    ).resolves.toMatchObject([{ key: 'runs.routes.demo', value: '{}' }]);
  });

  it('parks an unknown read and answers it once a scene registers', async () => {
    const { invoke } = internals();
    const pending = invoke('read_folder_signals', {});
    expect(await settled({ promise: pending })).toBe('PARKED');
    Reflect.set(Reflect.get(window, '__TAURI_INTERNALS__'), 'invoke', async (command: string) =>
      command === 'read_folder_signals' ? { ok: true } : undefined,
    );
    await expect(pending).resolves.toEqual({ ok: true });
  });

  it('answers a worktree change read with an empty summary, not a list', async () => {
    const { invoke } = internals();
    await expect(
      invoke('worktree_changed_files', { worktreePath: '/mock/payments-api' }),
    ).resolves.toEqual({ paths: [], entries: [], additions: 0, deletions: 0, numstat: '' });
  });

  it('keeps a push local and tells the visitor', async () => {
    const { invoke } = internals();
    await expect(invoke('git_push', { cwd: '/mock/payments-api' })).resolves.toMatchObject({
      exitCode: 0,
    });
    expect(store.getState().undoNotices.at(-1)?.toast).toMatchObject({
      kind: 'info',
      title: 'Demo playground',
    });
  });

  it('keeps a GitHub write local and parks a GitHub read', async () => {
    const { invoke } = internals();
    await invoke('gh_run', {
      args: ['api', '-X', 'POST', 'repos/acme/payments-api/pulls/318/comments'],
    });
    expect(store.getState().undoNotices).toHaveLength(1);
    expect(await settled({ promise: invoke('gh_run', { args: ['pr', 'view', '318'] }) })).toBe(
      'PARKED',
    );
  });

  it('falls back to the demo answer when a scene handler throws', async () => {
    Reflect.set(Reflect.get(window, '__TAURI_INTERNALS__'), 'invoke', async () => {
      throw new Error('not available in the mock scene');
    });
    const { invoke } = internals();
    await expect(
      invoke('db_execute', { sql: 'UPDATE agents SET status = ?', params: [] }),
    ).resolves.toMatchObject({
      rowsAffected: 1,
    });
  });
});
