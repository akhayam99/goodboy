// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId, WorktreeDetachAssessment } from '@goodboy/types';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';

const { removeMountWorktree, showToast, state, worktreeDetachAssessment } = vi.hoisted(() => ({
  removeMountWorktree: vi.fn(async () => ({ kind: 'removed', reason: null })),
  showToast: vi.fn(),
  state: {
    removeMountWorktree: vi.fn(async () => ({ kind: 'removed', reason: null })),
    sessions: [{ id: 'session-1', state: { kind: 'idle' } }],
    terminalTabs: {},
  },
  worktreeDetachAssessment: vi.fn(),
}));

state.removeMountWorktree = removeMountWorktree;

vi.mock('../../../../../store', () => ({
  useAppStore: <Value,>(selector: (store: typeof state) => Value) => selector(state),
}));

vi.mock('../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../../../../worktree/worktree', () => ({ worktreeDetachAssessment }));

import { RemoveWorktreeAction } from './RemoveWorktreeAction';

type TypedStringParams = {
  readonly value: string;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value =>
  JSON.parse(JSON.stringify(value));

const SESSION_ID = typedString<SessionId>({ value: 'session-1' });

const ROW = {
  mountId: typedString<MountId>({ value: 'mount-1' }),
  projectId: typedString<ProjectId>({ value: 'project-1' }),
  projectName: 'API',
  projectKind: 'repo',
  mountName: 'API',
  branch: 'ak/feat',
  baseBranch: 'main',
  worktreePath: '/worktrees/api',
  lastWorktreePath: '/worktrees/api',
  repoRoot: '/repos/api',
  isAttached: true,
  isOnDisk: true,
  revision: 3,
  parallelIndex: 0,
  request: null,
  series: null,
  observation: null,
  observedBranchHolder: null,
  isCompleted: true,
} satisfies MountRowView;

type AssessmentParams = {
  readonly ignoredFiles: number;
  readonly ignoredFileSamples: ReadonlyArray<string>;
};

const assessment = ({
  ignoredFiles,
  ignoredFileSamples,
}: AssessmentParams): WorktreeDetachAssessment => ({
  kind: 'assessed',
  path: '/worktrees/api',
  branch: 'ak/feat',
  hasUpstream: true,
  affectedFiles: 0,
  localOnlyCommits: 0,
  ignoredFiles,
  ignoredFileSamples,
});

const renderAction = () =>
  render(<RemoveWorktreeAction sessionId={SESSION_ID} row={ROW} label="API" />);

beforeEach(() => {
  vi.clearAllMocks();
  state.sessions = [{ id: 'session-1', state: { kind: 'idle' } }];
  state.terminalTabs = {};
  removeMountWorktree.mockResolvedValue({ kind: 'removed', reason: null });
});

afterEach(cleanup);

describe('RemoveWorktreeAction', () => {
  it('shows confirmation when ignored data is at risk', async () => {
    worktreeDetachAssessment.mockResolvedValue(
      assessment({ ignoredFiles: 1, ignoredFileSamples: ['.env.local'] }),
    );
    renderAction();

    fireEvent.click(screen.getByRole('button', { name: 'Remove the worktree for API' }));

    await waitFor(() => expect(screen.getByText('Remove worktree?')).toBeDefined());
    expect(
      screen.getByText('1 ignored file at risk, not tracked by git: .env.local.'),
    ).toBeDefined();
    expect(removeMountWorktree).not.toHaveBeenCalled();
  });

  it('removes immediately without confirmation when no data is at risk', async () => {
    worktreeDetachAssessment.mockResolvedValue(
      assessment({ ignoredFiles: 0, ignoredFileSamples: [] }),
    );
    renderAction();

    fireEvent.click(screen.getByRole('button', { name: 'Remove the worktree for API' }));

    await waitFor(() =>
      expect(removeMountWorktree).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        mountId: ROW.mountId,
        mode: 'safe',
      }),
    );
    expect(screen.queryByText('Remove worktree?')).toBeNull();
  });
});
