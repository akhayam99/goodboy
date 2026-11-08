// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const worktreeStatus = vi.hoisted(() => vi.fn());

vi.mock('../../../worktree/worktree', () => ({ worktreeStatus }));

import { resetWorktreeStatusCache } from '../../../../store/runtime/worktreeStatuses/cache';
import { useWorktreeStatusSnapshot, useWorktreeStatuses } from '.';

afterEach(() => {
  resetWorktreeStatusCache();
  worktreeStatus.mockReset();
});

type Targets = ReadonlyArray<{ readonly worktreePath: string; readonly baseBranch: string }>;

const MICROTASK_TURNS = 50;

type StatusParams = {
  readonly worktreePath: string;
};

describe('adding a worktree', () => {
  it('keeps the rows already read on screen, untouched, while the new one loads', async () => {
    worktreeStatus.mockResolvedValueOnce({ mainDistance: 1 });
    const seen: Array<boolean> = [];
    const view = renderHook(
      ({ targets }: { readonly targets: Targets }) => {
        const statuses = useWorktreeStatuses({ targets });
        seen.push(statuses.has('/repo/first'));
        return statuses;
      },
      { initialProps: { targets: [{ worktreePath: '/repo/first', baseBranch: 'main' }] } },
    );
    await waitFor(() => expect(view.result.current.has('/repo/first')).toBe(true));
    const settled = view.result.current;
    worktreeStatus.mockReturnValueOnce(new Promise(() => undefined));
    seen.length = 0;

    view.rerender({
      targets: [
        { worktreePath: '/repo/first', baseBranch: 'main' },
        { worktreePath: '/repo/second', baseBranch: 'main' },
      ],
    });

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((hasFirst) => hasFirst)).toBe(true);
    expect(view.result.current).toBe(settled);
  });
});

describe('changing the base branch of a worktree already read', () => {
  it('drops the distance read against the old base and holds the row until the new read lands', async () => {
    worktreeStatus.mockResolvedValueOnce({ mainDistance: 1 });
    const view = renderHook(
      ({ targets }: { readonly targets: Targets }) => useWorktreeStatusSnapshot({ targets }),
      { initialProps: { targets: [{ worktreePath: '/repo/first', baseBranch: 'main' }] } },
    );
    await waitFor(() => expect(view.result.current.statuses.has('/repo/first')).toBe(true));
    let answer: (status: { readonly mainDistance: number }) => void = () => undefined;
    worktreeStatus.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    view.rerender({ targets: [{ worktreePath: '/repo/first', baseBranch: 'develop' }] });

    expect(view.result.current.statuses.has('/repo/first')).toBe(false);
    expect(view.result.current.pending.has('/repo/first')).toBe(true);
    await act(async () => {
      await Array.from({ length: MICROTASK_TURNS }).reduce<Promise<void>>(
        (previous) => previous.then(() => new Promise<void>((resolve) => queueMicrotask(resolve))),
        Promise.resolve(),
      );
    });
    expect(view.result.current.statuses.has('/repo/first')).toBe(false);

    act(() => {
      answer({ mainDistance: 4 });
    });

    await waitFor(() =>
      expect(view.result.current.statuses.get('/repo/first')).toEqual({ mainDistance: 4 }),
    );
    expect(view.result.current.pending.size).toBe(0);
  });
});

describe('moving to other worktrees', () => {
  it('drops the answer for the set asked before and shows only the new set', async () => {
    const answers = new Map<string, (status: { readonly mainDistance: number }) => void>();
    worktreeStatus.mockImplementation(
      ({ worktreePath }: StatusParams) =>
        new Promise((resolve) => {
          answers.set(worktreePath, resolve);
        }),
    );
    const view = renderHook(
      ({ targets }: { readonly targets: Targets }) => useWorktreeStatuses({ targets }),
      { initialProps: { targets: [{ worktreePath: '/repo/old', baseBranch: 'main' }] } },
    );
    await waitFor(() => expect(answers.has('/repo/old')).toBe(true));

    view.rerender({ targets: [{ worktreePath: '/repo/new', baseBranch: 'main' }] });
    await waitFor(() => expect(answers.has('/repo/new')).toBe(true));
    await act(async () => {
      answers.get('/repo/old')?.({ mainDistance: 7 });
      await Array.from({ length: MICROTASK_TURNS }).reduce<Promise<void>>(
        (previous) => previous.then(() => new Promise<void>((resolve) => queueMicrotask(resolve))),
        Promise.resolve(),
      );
    });

    expect(view.result.current.has('/repo/old')).toBe(false);
    expect(view.result.current.size).toBe(0);

    act(() => {
      answers.get('/repo/new')?.({ mainDistance: 2 });
    });

    await waitFor(() => expect(view.result.current.get('/repo/new')).toEqual({ mainDistance: 2 }));
    expect(view.result.current.has('/repo/old')).toBe(false);
  });
});
