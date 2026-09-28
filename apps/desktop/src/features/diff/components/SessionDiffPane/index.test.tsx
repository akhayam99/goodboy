// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';

const h = vi.hoisted(() => ({
  status: null as unknown,
  commits: [] as ReadonlyArray<unknown>,
  canRebase: false,
  prediction: null as null | { conflictFiles: ReadonlyArray<string>; isClean: boolean },
  mountGithub: {} as Record<string, unknown>,
  openMountRequest: vi.fn(async () => ({ kind: 'opened' as const })),
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
    selector({
      settings: {},
      projects: [],
      emitNotification: vi.fn(),
      mountGithub: h.mountGithub,
      sessionGithub: {},
      sessionResolveThreads: {},
      openReviewTarget: vi.fn(),
      openMountRequest: h.openMountRequest,
    }),
}));

vi.mock('../../../../store/slices/project-mounts/selectors', () => ({
  selectMountForPath: () => MOUNT,
  selectActiveMountId: () => MOUNT.mountId,
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

vi.mock('../../../session/hooks/useRebaseBranch', () => ({
  useRebaseBranch: () => ({ canRebase: h.canRebase, isRunning: false, error: null, run: vi.fn() }),
}));

vi.mock('../../../history/useRebasePrediction', () => ({
  useRebasePrediction: () => h.prediction,
}));

vi.mock('../../../permissions/components/DiffViewSelector', () => ({
  DiffViewSelector: () => <button type="button">Branch vs main</button>,
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
  h.prediction = null;
  h.mountGithub = {};
  h.openMountRequest.mockClear();
});

describe('SessionDiffPane pull request link', () => {
  it('links the pull request of the branch it shows and opens its page', () => {
    h.mountGithub = {
      [MOUNT.mountId]: {
        pr: { number: 318, state: 'open', isDraft: false, url: '', title: 'Stop retried webhooks' },
      },
    };
    renderPane();

    fireEvent.click(screen.getByRole('button', { name: 'Open PR #318' }));

    expect(h.openMountRequest).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT.mountId,
      provider: 'github',
      requestNumber: 318,
    });
  });

  it('shows no pull request link and no Review door when the branch has none', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: /^Open PR/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Conversations' })).toBeNull();
  });
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

  it('names the predicted conflict on the rebase button before anything runs', () => {
    h.status = statusOf({ upstream: 'origin/fix', behind: 18 });
    h.canRebase = true;
    h.prediction = { conflictFiles: ['src/ledger/postings.ts'], isClean: false };
    renderPane();

    const button = screen.getByRole('button', { name: /Rebase on main · 1 conflict/ });
    expect(button.getAttribute('title')).toContain('src/ledger/postings.ts');
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
