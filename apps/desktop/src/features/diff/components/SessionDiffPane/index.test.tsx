// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';

const h = vi.hoisted(() => ({
  status: null as unknown,
  commits: [] as ReadonlyArray<unknown>,
  canRebase: false,
}));

const SESSION_ID = 'session-1' as SessionId;
const MOUNT = {
  mountId: 'mount-ledger' as MountId,
  mountName: 'ledger-core',
  branch: 'fix/ledger-reconcile-postings',
  worktreePath: '/w/ledger',
};

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({ settings: {}, emitNotification: vi.fn() }),
}));

vi.mock('../../../../store/slices/project-mounts/selectors', () => ({
  selectMountForPath: () => MOUNT,
}));

vi.mock('../../hooks/useSessionDiff', () => ({
  useSessionDiff: () => ({
    files: [],
    patch: '',
    loading: false,
    error: null,
    view: { kind: 'branch' },
    setView: vi.fn(),
    commits: h.commits,
    status: h.status,
    metaError: null,
    refresh: vi.fn(),
    viewed: {},
    focusPath: null,
    clearFocus: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDiffNotes', () => ({
  useDiffNotes: () => ({ comments: [], openNotes: [] }),
}));

vi.mock('../../../session/hooks/useRebaseAgent', () => ({
  useRebaseAgent: () => ({ canRebase: h.canRebase, isRunning: false, error: null, run: vi.fn() }),
}));

vi.mock('../../../permissions/components/DiffViewSelector', () => ({
  DiffViewSelector: () => <button type="button">Branch vs main</button>,
}));

vi.mock('../../../resolve/components/ResolveOverviewAction', () => ({
  ResolveOverviewAction: () => null,
}));

vi.mock('./PushBranchButton', () => ({
  PushBranchButton: () => <button type="button">Push branch</button>,
}));

import { SessionDiffPane } from './index';

const statusOf = ({
  upstream,
  behind,
}: {
  readonly upstream: string | null;
  readonly behind: number;
}): WorktreeStatus =>
  ({
    upstream,
    mainDistance: { kind: 'known', ahead: 3, behind },
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  }) as unknown as WorktreeStatus;

const renderPane = () =>
  render(
    <SessionDiffPane
      sessionId={SESSION_ID}
      workingDir="/w/ledger"
      worktreePath={MOUNT.worktreePath}
      diffFocus={null}
      branchRevision={0}
    />,
  );

afterEach(() => {
  cleanup();
  h.status = null;
  h.commits = [];
  h.canRebase = false;
});

describe('SessionDiffPane header', () => {
  it('rebases on main as the one primary when the branch is behind', () => {
    h.status = statusOf({ upstream: 'origin/fix', behind: 18 });
    h.canRebase = true;
    renderPane();

    expect(screen.getByRole('button', { name: /Rebase on main/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Push branch' })).toBeNull();
    expect(screen.getByText('Behind main by 18')).toBeDefined();
  });

  it('pushes a local-only branch that has commits', () => {
    h.status = statusOf({ upstream: null, behind: 0 });
    renderPane();

    expect(screen.getByRole('button', { name: 'Push branch' })).toBeDefined();
    expect(screen.getByText('Local only')).toBeDefined();
  });

  it('offers no primary on a branch that is on origin and up to date', () => {
    h.status = statusOf({ upstream: 'origin/fix', behind: 0 });
    renderPane();

    expect(screen.queryByRole('button', { name: /Rebase on main/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Push branch' })).toBeNull();
    expect(screen.getByText('On origin')).toBeDefined();
    expect(screen.getByText('ledger-core')).toBeDefined();
  });

  it('keeps the view selector in the file toolbar, under the title', () => {
    h.status = statusOf({ upstream: 'origin/fix', behind: 0 });
    renderPane();

    const header = document.querySelector('[data-slot="pane-header"]') as HTMLElement;
    const title = within(header).getByRole('heading', { name: 'Diff' });
    const selector = within(header).getByRole('button', { name: 'Branch vs main' });
    expect(title.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.closest('div')?.contains(selector)).toBe(false);
  });
});
