// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { OrphanWorktree } from '../../worktree';
import type { OrphanRemoval } from '../../../../store/slices/worktrees/removeOrphanWorktrees';

const { state, showToast } = vi.hoisted(() => ({
  state: {
    orphanWorktrees: {} as Record<string, ReadonlyArray<OrphanWorktree>>,
    removeOrphanWorktrees: vi.fn(
      async (_params: unknown): Promise<ReadonlyArray<OrphanRemoval>> => [],
    ),
    reportError: vi.fn(async () => undefined),
  },
  showToast: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

import { OrphanWorktreesSection } from './index';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const orphan = (name: string): OrphanWorktree => ({
  path: `/repo/.goodboy/worktrees/${name}`,
  name,
  sizeBytes: 1024,
  isRegistered: false,
});

beforeEach(() => {
  state.orphanWorktrees = {};
  state.removeOrphanWorktrees.mockReset();
  state.reportError.mockClear();
  showToast.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('OrphanWorktreesSection folder count copy', () => {
  it('renders nothing at zero orphans', () => {
    state.orphanWorktrees = { [WORKSPACE_ID]: [] };
    const { container } = render(<OrphanWorktreesSection workspaceId={WORKSPACE_ID} />);
    expect(container.firstChild).toBeNull();
  });

  it('singularizes the remove label at one orphan', () => {
    state.orphanWorktrees = { [WORKSPACE_ID]: [orphan('a')] };
    render(<OrphanWorktreesSection workspaceId={WORKSPACE_ID} />);
    expect(screen.getByText(/Remove 1 folder \(/)).toBeDefined();
  });

  it('pluralizes the remove label at two orphans', () => {
    state.orphanWorktrees = { [WORKSPACE_ID]: [orphan('a'), orphan('b')] };
    render(<OrphanWorktreesSection workspaceId={WORKSPACE_ID} />);
    expect(screen.getByText(/Remove 2 folders \(/)).toBeDefined();
  });
});

describe('OrphanWorktreesSection safe removal', () => {
  const clean = orphan('gb-clean');
  const dirty = orphan('gb-dirty');
  const leased = orphan('gb-busy');

  const removeAllSafely = async () => {
    fireEvent.click(screen.getByRole('button', { name: /remove 3 folders/i }));
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    await waitFor(() => expect(state.removeOrphanWorktrees).toHaveBeenCalledTimes(1));
  };

  beforeEach(() => {
    state.orphanWorktrees = { [WORKSPACE_ID]: [clean, dirty, leased] };
    state.removeOrphanWorktrees.mockImplementation(async () => {
      state.orphanWorktrees = { [WORKSPACE_ID]: [dirty, leased] };
      return [
        { kind: 'removed', path: clean.path },
        { kind: 'kept', path: dirty.path, reasons: ['unstaged-changes', 'untracked-files'] },
        { kind: 'kept', path: leased.path, reasons: ['writer-lease-held'] },
      ];
    });
  });

  it('asks in safe mode and shows why each kept folder stayed', async () => {
    const view = render(<OrphanWorktreesSection workspaceId={WORKSPACE_ID} />);

    await removeAllSafely();
    view.rerender(<OrphanWorktreesSection workspaceId={WORKSPACE_ID} />);

    expect(state.removeOrphanWorktrees).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      paths: [clean.path, dirty.path, leased.path],
      mode: 'safe',
    });
    expect(await screen.findByText('Has changes not committed')).toBeDefined();
    expect(screen.getByText('An agent is writing here')).toBeDefined();
    expect(showToast).toHaveBeenCalledWith({ kind: 'success', message: 'Removed 1 folder.' });
    expect(screen.getAllByRole('button', { name: /^remove anyway$/i })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /remove \d+ folders?/i })).toBeNull();
  });

  it('forces a dirty folder only after an inline confirm that names the loss', async () => {
    const view = render(<OrphanWorktreesSection workspaceId={WORKSPACE_ID} />);
    await removeAllSafely();
    view.rerender(<OrphanWorktreesSection workspaceId={WORKSPACE_ID} />);
    state.removeOrphanWorktrees.mockResolvedValueOnce([{ kind: 'removed', path: dirty.path }]);

    fireEvent.click(await screen.findByRole('button', { name: /^remove anyway$/i }));

    expect(screen.getByText(/Changes not committed in this folder will be lost/)).toBeDefined();
    expect(state.removeOrphanWorktrees).toHaveBeenCalledTimes(1);
    const confirm = screen.getByRole('group', { name: 'Remove gb-dirty anyway?' });
    fireEvent.click(
      Array.from(confirm.querySelectorAll('button')).find(
        (button) => button.textContent === 'Remove anyway',
      )!,
    );

    await waitFor(() =>
      expect(state.removeOrphanWorktrees).toHaveBeenLastCalledWith({
        workspaceId: WORKSPACE_ID,
        paths: [dirty.path],
        mode: 'confirmed',
      }),
    );
  });

  it('keeps a folder with commits not pushed and names them before a force', async () => {
    state.orphanWorktrees = { [WORKSPACE_ID]: [clean] };
    state.removeOrphanWorktrees.mockResolvedValueOnce([
      { kind: 'kept', path: clean.path, reasons: ['unpushed-commits'] },
    ]);
    render(<OrphanWorktreesSection workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: /remove 1 folder/i }));
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));

    expect(await screen.findByText('Has commits not pushed')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^remove anyway$/i }));
    expect(screen.getByText(/Its commits not pushed stay on the branch/)).toBeDefined();
  });

  it('routes a folder that failed outright to the error report', async () => {
    state.orphanWorktrees = { [WORKSPACE_ID]: [clean] };
    state.removeOrphanWorktrees.mockResolvedValueOnce([
      { kind: 'failed', path: clean.path, message: 'git failed' },
    ]);
    render(<OrphanWorktreesSection workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: /remove 1 folder/i }));
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));

    await waitFor(() => expect(state.reportError).toHaveBeenCalledTimes(1));
    expect(showToast).not.toHaveBeenCalled();
  });
});
