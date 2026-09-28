// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { MountId, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { setActiveLens, setDiffFocus } from '../../../../../store/slices/session-view/workSurface';
import type { GetFn, SetFn } from '../../../../../store/slices/session-view/types';

const SESSION_ID = 'ses-1' as SessionId;

type State = Record<string, unknown>;

const state: State = {};

const mountOf = ({
  name,
  worktreePath,
}: {
  readonly name: string;
  readonly worktreePath: string;
}): SessionProjectMount => ({
  mountId: `mount-${name}` as MountId,
  sessionId: 'session-files' as SessionId,
  projectId: `prj-${name}` as ProjectId,
  mountName: name,
  worktreePath,
  lastWorktreePath: null,
  repoRoot: `/repos/${name}`,
  branch: 'main',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
});

const API_MOUNT = mountOf({ name: 'api', worktreePath: '/wt/api' });
const WEB_MOUNT = mountOf({ name: 'web', worktreePath: '/wt/web' });

const set = ((updater: unknown) => {
  const patch = typeof updater === 'function' ? (updater as (s: State) => State)(state) : updater;
  Object.assign(state, patch);
}) as unknown as SetFn;

const get = (() => state) as unknown as GetFn;

vi.mock('../../../../../store', async () => ({
  ...(await import('../../../../../store/slices/navigation/place')),
  useAppStore: <T,>(selector: (s: State) => T) => selector(state),
}));

vi.mock('../../../../diff/components/SessionDiffPane', () => ({
  DIFF_PANE_TITLE: 'Diff',
  SessionDiffPane: ({
    diffFocus,
    worktreePath,
  }: {
    diffFocus: { readonly kind: string } | null;
    worktreePath?: string;
  }) => (
    <div
      data-testid="diff-viewer"
      data-focus-kind={diffFocus?.kind ?? 'none'}
      data-worktree={worktreePath ?? 'none'}
    />
  ),
}));

vi.mock('../../../../history/components/RewriteHistoryPage', () => ({
  RewriteHistoryPage: ({ worktreePath }: { readonly worktreePath: string }) => (
    <div data-testid="rewrite-history" data-worktree={worktreePath} />
  ),
}));

vi.mock('./FileVersionsPane', () => ({
  FileVersionsPane: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="file-versions">
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

import { FilesPane } from './FilesPane';

const reset = ({ mounts = [] }: { readonly mounts?: ReadonlyArray<SessionProjectMount> } = {}) => {
  for (const key of Object.keys(state)) {
    delete state[key];
  }
  Object.assign(state, {
    activeLens: {},
    selectedAgentId: {},
    sessionStudio: {},
    diffFocus: {},
    diffMountPath: {},
    resolveDiffReturn: {},
    returnFromResolveDiff: () => undefined,
    focusedWorkflowRunId: {},
    lensHistory: {},
    sessionPhaseRuns: { [SESSION_ID]: [] },
    sessionProjectMounts: { [SESSION_ID]: mounts },
    setDiffFocus: setDiffFocus(set),
    setActiveLens: setActiveLens(set),
    diffPage: {},
  });
};

const renderPane = ({ worktreePath }: { readonly worktreePath: string | null }) =>
  render(
    <FilesPane
      sessionId={SESSION_ID}
      sessionDir="/tmp/wt"
      worktreePath={worktreePath}
      isBranchless={false}
      onClose={() => undefined}
    />,
  );

const renderBranchlessPane = () =>
  render(
    <FilesPane
      sessionId={SESSION_ID}
      sessionDir="/tmp/wt"
      worktreePath={null}
      isBranchless
      onClose={() => undefined}
    />,
  );

afterEach(cleanup);

describe('FilesPane', () => {
  it('shows the Rewrite history page as the child page of the branch', () => {
    reset();
    state['diffPage'] = { [SESSION_ID]: 'history' };

    renderPane({ worktreePath: '/wt/web' });

    expect(screen.getByTestId('rewrite-history').getAttribute('data-worktree')).toBe('/wt/web');
    expect(screen.queryByTestId('diff-viewer')).toBeNull();
  });

  it('carries the working tree focus into the diff', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'files');
    setDiffFocus(set)(SESSION_ID, { kind: 'working', path: null });

    renderPane({ worktreePath: '/tmp/wt' });

    expect(screen.getByTestId('diff-viewer').getAttribute('data-focus-kind')).toBe('working');
  });

  it('explains itself when there is no worktree to diff', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'files');

    renderPane({ worktreePath: null });

    expect(screen.getByText('No worktree for this session')).toBeTruthy();
  });

  it('shows one branch and no worktree tabs above the diff', () => {
    reset({ mounts: [API_MOUNT, WEB_MOUNT] });
    setActiveLens(set)(SESSION_ID, 'files');

    renderPane({ worktreePath: API_MOUNT.worktreePath });

    expect(screen.queryByTestId('diff-mount-switcher')).toBeNull();
    expect(screen.queryByRole('button', { name: /web/ })).toBeNull();
  });

  it('diffs the mount it was handed, not the first one mounted', () => {
    reset({ mounts: [API_MOUNT, WEB_MOUNT] });
    setActiveLens(set)(SESSION_ID, 'files');

    renderPane({ worktreePath: WEB_MOUNT.worktreePath });

    expect(screen.getByTestId('diff-viewer').getAttribute('data-worktree')).toBe(
      WEB_MOUNT.worktreePath,
    );
  });

  it('shows the file versions pane with its own close control when branchless', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'files');

    renderBranchlessPane();

    expect(screen.getByTestId('file-versions')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});
