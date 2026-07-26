// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, listLocalBranches, showToast } = vi.hoisted(() => ({
  state: {
    session: { id: 'sess-1', workspaceId: 'ws-1' },
    sessionBranches: {
      'sess-1': 'feat/current',
      'sess-2': 'main',
    } as Record<string, string>,
    workspaces: [{ id: 'ws-1', rootPath: '/repo', kind: 'repo' }],
    changeSessionBranch: vi.fn(async () => undefined),
  },
  listLocalBranches: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
  useSessionById: () => state.session,
}));

vi.mock('../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../worktree', () => ({
  listLocalBranches,
}));

vi.mock('../BranchCombobox', () => ({
  BranchCombobox: ({
    branches,
    onChange,
  }: {
    branches: ReadonlyArray<{ name: string }>;
    onChange: (value: string) => void;
  }) => (
    <div>
      {branches.map((branch) => (
        <button key={branch.name} type="button" onClick={() => onChange(branch.name)}>
          Select {branch.name}
        </button>
      ))}
    </div>
  ),
}));

import { BranchSwitchPanel } from '.';

beforeEach(() => {
  state.sessionBranches = {
    'sess-1': 'feat/current',
    'sess-2': 'main',
  };
  state.changeSessionBranch.mockReset();
  state.changeSessionBranch.mockResolvedValue(undefined);
  listLocalBranches.mockReset();
  listLocalBranches.mockResolvedValue([
    { name: 'main', inUse: true, hasUncommitted: false },
    { name: 'feat/next', inUse: false, hasUncommitted: false },
  ]);
  showToast.mockReset();
});

afterEach(cleanup);

describe('BranchSwitchPanel', () => {
  it('switches to a clean existing branch and closes', async () => {
    const onDone = vi.fn();
    render(<BranchSwitchPanel sessionId={'sess-1' as never} onDone={onDone} />);

    await waitFor(() => screen.getByRole('button', { name: 'Select feat/next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select feat/next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch branch' }));

    await waitFor(() =>
      expect(state.changeSessionBranch).toHaveBeenCalledWith('sess-1', {
        branch: 'feat/next',
        createNew: false,
      }),
    );
    expect(showToast).toHaveBeenCalledWith('success', 'branch switched to feat/next');
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('requires a second confirmation for a branch used elsewhere', async () => {
    render(<BranchSwitchPanel sessionId={'sess-1' as never} onDone={vi.fn()} />);

    await waitFor(() => screen.getByRole('button', { name: 'Select main' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select main' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch branch' }));

    expect(screen.getByText('Already attached to another session')).toBeDefined();
    expect(state.changeSessionBranch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm switch' }));
    await waitFor(() => expect(state.changeSessionBranch).toHaveBeenCalledOnce());
  });
});
