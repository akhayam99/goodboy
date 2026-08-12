// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  openDiffLens,
  setActiveLens,
  setDiffFocus,
} from '../../../../../store/slices/session-view/workSurface';
import type { GetFn, SetFn } from '../../../../../store/slices/session-view/types';

const SESSION_ID = 'ses-1' as SessionId;

type State = Record<string, unknown>;

const state: State = {};

const set = ((updater: unknown) => {
  const patch = typeof updater === 'function' ? (updater as (s: State) => State)(state) : updater;
  Object.assign(state, patch);
}) as unknown as SetFn;

const get = (() => state) as unknown as GetFn;

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (s: State) => T) => selector(state),
}));

vi.mock('../../../../permissions/components/DiffViewerDialog', () => ({
  DiffViewerPane: ({ diffFocus }: { diffFocus: { readonly kind: string } | null }) => (
    <div data-testid="diff-viewer" data-focus-kind={diffFocus?.kind ?? 'none'} />
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

const reset = () => {
  for (const key of Object.keys(state)) {
    delete state[key];
  }
  Object.assign(state, {
    activeLens: {},
    selectedAgentId: {},
    sessionStudio: {},
    diffFocus: {},
    focusedWorkflowRunId: {},
    lensHistory: {},
    sessionPhaseRuns: { [SESSION_ID]: [] },
    setDiffFocus: setDiffFocus(set),
    setActiveLens: setActiveLens(set),
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
  it('carries the working tree focus into the diff', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'resolve');
    openDiffLens(get)(SESSION_ID, { kind: 'working', path: null });

    renderPane({ worktreePath: '/tmp/wt' });

    expect(screen.getByTestId('diff-viewer').getAttribute('data-focus-kind')).toBe('working');
  });

  it('explains itself when there is no worktree to diff', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'files');

    renderPane({ worktreePath: null });

    expect(screen.getByText('No worktree for this session')).toBeTruthy();
  });

  it('shows the file versions pane with its own close control when branchless', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'files');

    renderBranchlessPane();

    expect(screen.getByTestId('file-versions')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});
