// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  lensGo,
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
  DiffViewerPane: ({
    diffFocus,
    paneActions,
  }: {
    diffFocus: { readonly kind: string } | null;
    paneActions: React.ReactNode;
  }) => (
    <div data-testid="diff-viewer" data-focus-kind={diffFocus?.kind ?? 'none'}>
      {paneActions}
    </div>
  ),
}));

vi.mock('./FileVersionsPane', () => ({
  FileVersionsPane: ({ actions, onClose }: { actions?: React.ReactNode; onClose: () => void }) => (
    <div data-testid="file-versions">
      {actions}
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
    lensGo: lensGo(set, get),
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
  it('carries the working tree focus into the diff and offers the way back', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'resolve');
    openDiffLens(get)(SESSION_ID, { kind: 'working', path: null });

    renderPane({ worktreePath: '/tmp/wt' });

    expect(screen.getByTestId('diff-viewer').getAttribute('data-focus-kind')).toBe('working');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect((state['activeLens'] as Record<string, string>)[SESSION_ID]).toBe('resolve');
  });

  it('offers no way back when the diff is where the session started', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'files');

    renderPane({ worktreePath: '/tmp/wt' });

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('keeps the way back when there is no worktree to diff', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'resolve');
    setActiveLens(set)(SESSION_ID, 'files');

    renderPane({ worktreePath: null });

    expect(screen.getByText('No worktree for this session')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });

  it('carries the way back into the branchless file versions pane too', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'resolve');
    setActiveLens(set)(SESSION_ID, 'files');

    renderBranchlessPane();

    expect(screen.getByTestId('file-versions')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect((state['activeLens'] as Record<string, string>)[SESSION_ID]).toBe('resolve');
  });

  it('keeps back and close as two distinct controls on the branchless file versions pane', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'resolve');
    setActiveLens(set)(SESSION_ID, 'files');

    renderBranchlessPane();

    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});
