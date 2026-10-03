// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const worktreeStatus = vi.hoisted(() => vi.fn());

vi.mock('../../../worktree/worktree', () => ({ worktreeStatus }));

import { resetWorktreeStatusCache } from '../../../../store/slices/worktreeStatuses/cache';
import { useWorktreeStatuses } from '.';

afterEach(() => {
  resetWorktreeStatusCache();
  worktreeStatus.mockReset();
});

type Targets = ReadonlyArray<{ readonly worktreePath: string; readonly baseBranch: string }>;

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
