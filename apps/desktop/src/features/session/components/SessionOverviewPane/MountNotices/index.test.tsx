// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId, type WorktreeStatus } from '@goodboy/types';
import { aMountRow } from '../../../central/branches/testing/aMountRow';

vi.mock('../../../../actions/useActionControls', () => ({
  useActionControls: () => ({ failure: null, trigger: vi.fn() }),
}));
vi.mock('../../../../worktree/useMountRemoteHostKind', () => ({
  useMountRemoteHostKind: () => null,
}));
vi.mock('../ClosedWorktreeNotice', () => ({ ClosedWorktreeNotice: () => <p>closed notice</p> }));
vi.mock('../ProjectMountRows/AlsoInChip', () => ({ AlsoInChip: () => <p>also in</p> }));
vi.mock('../ProjectMountRows/ForeignCommitsNotice', () => ({
  ForeignCommitsNotice: () => <p>foreign commits</p>,
}));
vi.mock('../ProjectMountRows/MountActionFailureNotice', () => ({
  MountActionFailureNotice: () => <p>action failure</p>,
}));
vi.mock('../ProjectMountRows/MountBranchDecision', () => ({
  MountBranchDecision: () => <p>branch decision</p>,
}));
vi.mock('../ProjectMountRows/RebaseStoppedNotice', () => ({
  RebaseStoppedNotice: () => <p>rebase stopped</p>,
}));

import { MountNotices } from '.';

afterEach(cleanup);

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });

const ROW = {
  ...aMountRow({ key: 'api', projectName: 'payments-api', branch: 'feature/x' }),
  projectKind: 'repo',
  isAttached: true,
  worktreePath: '/worktrees/api',
} satisfies ReturnType<typeof aMountRow>;

const statusOf = (inProgress: WorktreeStatus['inProgress']): WorktreeStatus => ({
  branch: 'feature/x',
  head: 'abc123',
  headSubject: 'base',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 1, behind: 2 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/feature/x',
  inProgress,
});

const renderNotices = (inProgress: WorktreeStatus['inProgress']) =>
  render(<MountNotices sessionId={SESSION_ID} row={ROW} status={statusOf(inProgress)} />);

describe('MountNotices', () => {
  it('draws only the stopped rebase when one is open', () => {
    renderNotices('rebase');

    screen.getByText('rebase stopped');
    expect(screen.queryByText('foreign commits')).toBeNull();
    expect(screen.queryByText('also in')).toBeNull();
  });

  it('draws the other notices when no rebase is open', () => {
    renderNotices(null);

    expect(screen.queryByText('rebase stopped')).toBeNull();
    expect(screen.queryByText('setup offer')).toBeNull();
    screen.getByText('also in');
  });
});
