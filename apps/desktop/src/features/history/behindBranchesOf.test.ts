import { describe, expect, it, vi } from 'vitest';
import type { MountId, Project, SessionId, SessionProjectMount } from '@goodboy/types';
import type { AppStore } from '../../store/store';

const { statuses } = vi.hoisted(() => ({
  statuses: {} as Record<string, unknown>,
}));

vi.mock('../../store/runtime/worktreeStatuses/cache', () => ({
  readWorktreeStatus: (key: string) => statuses[key] ?? null,
  worktreeStatusKey: ({ worktreePath }: { readonly worktreePath: string }) => worktreePath,
}));

import { behindBranchesOf } from './behindBranchesOf';

const SESSION = 'session-ledger' as SessionId;
const MERGED = 'mount-merged' as MountId;
const CLOSED = 'mount-closed' as MountId;
const OPEN = 'mount-open' as MountId;

const mountOf = ({ id, path }: { readonly id: MountId; readonly path: string }) =>
  ({
    mountId: id,
    projectId: 'project-ledger',
    isAttached: true,
    worktreePath: path,
    branch: `ak/${id}`,
    baseBranch: 'main',
  }) as unknown as SessionProjectMount;

const prOf = ({ number, state }: { readonly number: number; readonly state: string }) => ({
  pr: { number, state, isDraft: false, url: '', title: 'Ledger', checks: null },
});

const stateOf = (): AppStore =>
  ({
    sessionProjectMounts: {
      [SESSION]: [
        mountOf({ id: MERGED, path: '/wt/merged' }),
        mountOf({ id: CLOSED, path: '/wt/closed' }),
        mountOf({ id: OPEN, path: '/wt/open' }),
      ],
    },
    projects: [{ id: 'project-ledger', baseBranch: 'main' }] as unknown as ReadonlyArray<Project>,
    mountGithub: {
      [MERGED]: prOf({ number: 1, state: 'merged' }),
      [CLOSED]: prOf({ number: 2, state: 'closed' }),
      [OPEN]: prOf({ number: 3, state: 'open' }),
    },
  }) as unknown as AppStore;

describe('behindBranchesOf', () => {
  it('skips a merged branch and keeps a closed unmerged one that fell behind', () => {
    for (const path of ['/wt/merged', '/wt/closed', '/wt/open']) {
      statuses[path] = { mainDistance: { kind: 'known', ahead: 1, behind: 3 }, inProgress: null };
    }

    const found = behindBranchesOf({ state: stateOf(), sessionId: SESSION });

    expect(found.map((branch) => branch.mountId)).toEqual([CLOSED, OPEN]);
  });
});
