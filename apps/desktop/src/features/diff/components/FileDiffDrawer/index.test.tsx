// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  loader: null as null | (() => Promise<string>),
  diff: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) => selector(h.state),
}));

vi.mock('../../../worktree/worktree', () => ({
  worktreeDiff: h.diff,
  worktreeDiffCommit: vi.fn(),
}));

vi.mock('../../hooks/useSessionDiff', () => ({
  useSessionDiff: ({ loader }: { readonly loader: () => Promise<string> }) => {
    h.loader = loader;
    return { files: [], loading: false, error: null, refresh: vi.fn() };
  },
}));

import { FileDiffDrawer } from '.';

const SESSION_ID = 'session-drawer' as SessionId;
const WORKTREE = '/repo/storefront-web';

const stateWith = ({
  mountBase,
  projectBase,
}: {
  readonly mountBase: string | null;
  readonly projectBase: string | null;
}) => ({
  projects: [{ id: 'project-storefront', baseBranch: projectBase }],
  sessions: [{ id: SESSION_ID }],
  sessionProjectMounts: {
    [SESSION_ID]: [
      {
        projectId: 'project-storefront',
        worktreePath: WORKTREE,
        repoRoot: '/repo/storefront-web',
        branch: 'feat/cart',
        mountName: 'storefront-web',
        baseBranch: mountBase,
      },
    ],
  },
  openMountDiff: vi.fn(),
  setDiffFocus: vi.fn(),
});

const mount = () => {
  render(
    <FileDiffDrawer
      sessionId={SESSION_ID}
      source={{ kind: 'worktree', worktreePath: WORKTREE }}
      path="src/cart.ts"
      onClose={vi.fn()}
    />,
  );
};

beforeEach(() => {
  h.loader = null;
  h.diff.mockReset().mockResolvedValue('');
});

afterEach(cleanup);

describe('FileDiffDrawer base branch', () => {
  it('loads the worktree diff against the base the user picked', async () => {
    h.state = stateWith({ mountBase: null, projectBase: 'develop' });

    mount();
    await h.loader?.();

    expect(h.diff).toHaveBeenCalledWith({ worktreePath: WORKTREE, baseBranch: 'develop' });
  });

  it('keeps the backend default when no base was picked', async () => {
    h.state = stateWith({ mountBase: null, projectBase: null });

    mount();
    await h.loader?.();

    expect(h.diff).toHaveBeenCalledWith({ worktreePath: WORKTREE, baseBranch: null });
  });
});
