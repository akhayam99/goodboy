// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AgentRole, WorkspaceId, WorkspaceKind } from '@goodboy/types';

type Store = {
  readonly currentWorkspaceId: WorkspaceId;
  readonly workspaces: ReadonlyArray<{
    readonly id: WorkspaceId;
    readonly kind?: WorkspaceKind;
  }>;
};

const h = vi.hoisted(() => ({
  workspaceKind: 'simple' as WorkspaceKind,
}));

vi.mock('../../../../store', () => ({
  useCurrentWorkspace: () => ({ id: 'workspace-1' as WorkspaceId, kind: h.workspaceKind }),
}));

import { RoleSelect } from '.';

afterEach(() => {
  cleanup();
  h.workspaceKind = 'simple';
});

describe('RoleSelect', () => {
  it('offers only scout, planner, and custom in a simple workspace', () => {
    render(<RoleSelect value={'custom' as AgentRole} onChange={vi.fn()} disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Custom/i }));
    const options = within(screen.getByRole('listbox', { name: 'agent role' }));

    expect(options.getAllByRole('button').map((option) => option.textContent)).toEqual([
      'Scout',
      'Planner',
      'Custom',
    ]);
  });
});
