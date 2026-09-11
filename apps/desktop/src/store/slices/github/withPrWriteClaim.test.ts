import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId } from '@goodboy/types';

const hoisted = vi.hoisted(() => ({
  announcePrWrite: vi.fn<(announcement: unknown) => Promise<void>>(async () => undefined),
  currentWindowLabel: vi.fn(() => 'win-here'),
}));

vi.mock('../../../features/review/prWriteBus', () => ({
  announcePrWrite: hoisted.announcePrWrite,
}));
vi.mock('../../../features/workspace/window', () => ({
  currentWindowLabel: hoisted.currentWindowLabel,
}));

import { createPrWritesSlice } from '../pr-writes';
import { PR_WRITE_CLAIM_TTL_MS, prWritesInitialState } from '../pr-writes/state';
import { withPrWriteClaim } from './withPrWriteClaim';
import type { GetFn, SetFn } from './types';

const PROJECT_ID = 'project-1' as ProjectId;
const TARGET = { projectId: PROJECT_ID, prNumber: 248 };

const harness = () => {
  let state: Record<string, unknown> = { ...prWritesInitialState };
  const set = ((patch: unknown) => {
    const next =
      typeof patch === 'function'
        ? (patch as (s: Record<string, unknown>) => object)(state)
        : patch;
    state = { ...state, ...(next as object) };
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  state = { ...state, ...createPrWritesSlice(set, get) };
  return { get };
};

type PendingRun = {
  readonly run: () => Promise<void>;
  readonly settle: () => void;
};

const pendingRun = (): PendingRun => {
  let release: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    run: () => promise,
    settle: () => release?.(),
  };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-11T10:00:00.000Z'));
  hoisted.announcePrWrite.mockClear();
  hoisted.currentWindowLabel.mockReturnValue('win-here');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withPrWriteClaim', () => {
  it('refuses a second write while the first is still running', async () => {
    const { get } = harness();
    const first = pendingRun();
    const running = withPrWriteClaim({ get, ...TARGET, action: 'merge', run: first.run });
    await Promise.resolve();

    await expect(
      withPrWriteClaim({ get, ...TARGET, action: 'close', run: async () => undefined }),
    ).rejects.toThrow('Goodboy is already merging #248');

    first.settle();
    await running;
  });

  it('frees the pull request once the write settles', async () => {
    const { get } = harness();
    await withPrWriteClaim({ get, ...TARGET, action: 'merge', run: async () => undefined });

    await expect(
      withPrWriteClaim({ get, ...TARGET, action: 'close', run: async () => undefined }),
    ).resolves.toBeUndefined();
  });

  it('frees the pull request when the write fails', async () => {
    const { get } = harness();
    await expect(
      withPrWriteClaim({
        get,
        ...TARGET,
        action: 'merge',
        run: async () => {
          throw new Error('gh pr merge exited with 1');
        },
      }),
    ).rejects.toThrow('gh pr merge exited with 1');

    await expect(
      withPrWriteClaim({ get, ...TARGET, action: 'close', run: async () => undefined }),
    ).resolves.toBeUndefined();
  });

  it('keeps the second write protected when the first one outlives the ttl', async () => {
    const { get } = harness();
    const first = pendingRun();
    const second = pendingRun();

    const merging = withPrWriteClaim({ get, ...TARGET, action: 'merge', run: first.run });
    await Promise.resolve();

    vi.advanceTimersByTime(PR_WRITE_CLAIM_TTL_MS);

    const closing = withPrWriteClaim({ get, ...TARGET, action: 'close', run: second.run });
    await Promise.resolve();

    first.settle();
    await merging;

    await expect(
      withPrWriteClaim({ get, ...TARGET, action: 'ready', run: async () => undefined }),
    ).rejects.toThrow('Goodboy is already closing #248');

    second.settle();
    await closing;
  });
});
