// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storySpies } from '../../store/storyHarness';
import { liveMounts } from './liveMounts';

type Pending = {
  resolve: (value: unknown) => void;
};

type RowParams = {
  readonly mountId: string;
};

const row = ({ mountId }: RowParams) => ({
  mountId,
  sessionId: 's-1',
  projectId: 'p-1',
  branch: `hl/${mountId}`,
  createdAt: 1,
  port: 41000,
  hasFixedPort: false,
  paths: ['src/retry/state.ts'],
});

const pending: Array<Pending> = [];

beforeEach(() => {
  liveMounts.reset();
  pending.length = 0;
  storySpies.tauriInvoke.mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push({ resolve });
      }),
  );
});

afterEach(() => {
  liveMounts.reset();
  storySpies.tauriInvoke.mockReset();
});

describe('liveMounts', () => {
  it('keeps only the latest answer when an older read lands late', async () => {
    const first = liveMounts.refresh();
    const second = liveMounts.refresh();
    pending[1]?.resolve([row({ mountId: 'fresh' })]);
    await second;
    pending[0]?.resolve([row({ mountId: 'stale' })]);
    await first;

    expect(liveMounts.snapshot().mounts.map((mount) => mount.mountId)).toEqual(['fresh']);
  });

  it('keeps the last mounts and says the read failed when git cannot be read', async () => {
    const ok = liveMounts.refresh();
    pending[0]?.resolve([row({ mountId: 'kept' })]);
    await ok;
    storySpies.tauriInvoke.mockRejectedValueOnce(new Error('git is gone'));

    await liveMounts.refresh();

    expect(liveMounts.snapshot()).toMatchObject({ hasFailed: true, isLoaded: true });
    expect(liveMounts.snapshot().mounts.map((mount) => mount.mountId)).toEqual(['kept']);
  });

  it('reads once for many listeners and stops when the last one leaves', () => {
    const stopA = liveMounts.subscribe({ listener: () => undefined });
    const stopB = liveMounts.subscribe({ listener: () => undefined });

    expect(storySpies.tauriInvoke).toHaveBeenCalledTimes(1);
    stopA();
    stopB();
    liveMounts.subscribe({ listener: () => undefined });
    expect(storySpies.tauriInvoke).toHaveBeenCalledTimes(2);
  });
});
