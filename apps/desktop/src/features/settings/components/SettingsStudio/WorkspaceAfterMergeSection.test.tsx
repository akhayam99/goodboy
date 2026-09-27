// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const WORKSPACE = 'ws-harborline' as WorkspaceId;

const { state, autoDelete } = vi.hoisted(() => ({
  state: {
    workspaceOverrides: {} as Record<string, { readonly afterMerge: string | null }>,
    projects: [] as ReadonlyArray<Record<string, unknown>>,
    patchWorkspaceOverrides: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
  },
  autoDelete: vi.fn(async (): Promise<boolean | null> => null),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));
vi.mock('../../../../store/slices/branch-cleanup/repoDeletesMergedBranches', () => ({
  repoDeletesMergedBranches: autoDelete,
}));

import { WorkspaceAfterMergeSection } from './WorkspaceAfterMergeSection';

const payments = {
  id: 'proj-payments',
  workspaceId: WORKSPACE,
  name: 'payments-api',
  kind: 'repo',
  rootPath: '/repos/payments-api',
};

const ledger = {
  id: 'proj-ledger',
  workspaceId: WORKSPACE,
  name: 'ledger-core',
  kind: 'repo',
  rootPath: '/repos/ledger-core',
};

beforeEach(() => {
  vi.clearAllMocks();
  state.workspaceOverrides = {};
  state.projects = [payments];
  autoDelete.mockResolvedValue(null);
});
afterEach(cleanup);

describe('WorkspaceAfterMergeSection', () => {
  it('reads Delete on this Mac for a workspace that never chose', () => {
    render(<WorkspaceAfterMergeSection workspaceId={WORKSPACE} />);

    expect(
      screen
        .getByRole('tab', { name: 'Delete folder and branch on this Mac' })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByText(/Never deletes a branch with commits after the merge/)).toBeDefined();
  });

  it('saves the rule the user picks', async () => {
    state.workspaceOverrides = { [WORKSPACE]: { afterMerge: 'ask' } };
    render(<WorkspaceAfterMergeSection workspaceId={WORKSPACE} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Also delete the branch on origin' }));

    await waitFor(() =>
      expect(state.patchWorkspaceOverrides).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        patch: { afterMerge: 'local-and-origin' },
      }),
    );
  });

  it('turns off the origin choice when GitHub already deletes merged branches', async () => {
    autoDelete.mockResolvedValue(true);
    render(<WorkspaceAfterMergeSection workspaceId={WORKSPACE} />);

    expect(
      await screen.findByText(
        'GitHub already deletes merged branches in payments-api (repository setting).',
      ),
    ).toBeDefined();
    expect(
      (screen.getByRole('tab', { name: 'Also delete the branch on origin' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('collapses more than one auto-deleting repo into one line with a disclosure', async () => {
    state.projects = [payments, ledger];
    autoDelete.mockResolvedValue(true);
    render(<WorkspaceAfterMergeSection workspaceId={WORKSPACE} />);

    expect(
      await screen.findByText('GitHub already deletes merged branches in 2 repositories.'),
    ).toBeDefined();
    expect(screen.queryByText('payments-api')).toBeNull();
    expect(screen.queryByText('ledger-core')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'GitHub already deletes merged branches in 2 repositories.',
      }),
    );

    expect(screen.getByText('payments-api')).toBeDefined();
    expect(screen.getByText('ledger-core')).toBeDefined();
  });
});
