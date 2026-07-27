// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, listLocalBranches, getCachedLocalBranches, showToast } = vi.hoisted(() => ({
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
  getCachedLocalBranches: vi.fn(
    (): ReadonlyArray<{ name: string; inUse: boolean; hasUncommitted: boolean }> | undefined =>
      undefined,
  ),
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
  getCachedLocalBranches,
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
  getCachedLocalBranches.mockReset();
  getCachedLocalBranches.mockReturnValue(undefined);
  showToast.mockReset();
});

afterEach(cleanup);

describe('BranchSwitchPanel', () => {
  it('opens on the Create new tab with the branch name input ready to type', () => {
    render(<BranchSwitchPanel sessionId={'sess-1' as never} onDone={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Create new' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('textbox', { name: 'New branch' })).toBeDefined();
  });

  it('shows a loading state in the Pick existing tab label while the branch list is in flight', async () => {
    let resolveBranches: (
      branches: ReadonlyArray<{ name: string; inUse: boolean; hasUncommitted: boolean }>,
    ) => void = () => {};
    listLocalBranches.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBranches = resolve;
        }),
    );

    render(<BranchSwitchPanel sessionId={'sess-1' as never} onDone={vi.fn()} />);

    const loadingTab = screen.getByRole('tab', { name: 'Pick existing (loading)' });
    fireEvent.click(loadingTab);
    expect(
      screen.getByRole('tab', { name: 'Pick existing (loading)' }).getAttribute('aria-selected'),
    ).toBe('true');

    resolveBranches([{ name: 'main', inUse: false, hasUncommitted: false }]);
    await waitFor(() => screen.getByRole('tab', { name: 'Pick existing' }));
  });

  it('keeps the submit gate blocked on a warm cache until the background refresh settles', async () => {
    getCachedLocalBranches.mockReturnValue([{ name: 'main', inUse: false, hasUncommitted: false }]);
    let resolveBranches: (
      branches: ReadonlyArray<{ name: string; inUse: boolean; hasUncommitted: boolean }>,
    ) => void = () => {};
    listLocalBranches.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBranches = resolve;
        }),
    );

    render(<BranchSwitchPanel sessionId={'sess-1' as never} onDone={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Pick existing (loading)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select main' }));

    const submit = screen.getByRole('button', { name: 'Switch branch' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(state.changeSessionBranch).not.toHaveBeenCalled();

    resolveBranches([{ name: 'main', inUse: false, hasUncommitted: false }]);
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Switch branch' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it('switches to a clean existing branch and closes', async () => {
    const onDone = vi.fn();
    render(<BranchSwitchPanel sessionId={'sess-1' as never} onDone={onDone} />);

    fireEvent.click(screen.getByRole('tab', { name: /pick existing/i }));
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

  it('renders nothing for a branchless session in a converted workspace', () => {
    state.sessionBranches = { 'sess-1': '', 'sess-2': 'main' };
    const { container } = render(
      <BranchSwitchPanel sessionId={'sess-1' as never} onDone={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('requires a second confirmation for a branch used elsewhere', async () => {
    render(<BranchSwitchPanel sessionId={'sess-1' as never} onDone={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: /pick existing/i }));
    await waitFor(() => screen.getByRole('button', { name: 'Select main' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select main' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch branch' }));

    expect(screen.getByText('Already attached to another session')).toBeDefined();
    expect(state.changeSessionBranch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm switch' }));
    await waitFor(() => expect(state.changeSessionBranch).toHaveBeenCalledOnce());
  });
});
