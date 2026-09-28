// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const h = vi.hoisted(() => ({
  relocate: vi.fn(async () => undefined),
  clear: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: unknown) => T) =>
    selector({
      projectRelocationCandidates: [
        { projectId: 'p-1', isSelected: true, toRoot: '/code/ledger-core' },
      ],
      projectRelocationCompleted: [],
      projectRelocationPhase: 'review',
      projectRelocationError: null,
      projectRelocationWorkspaceId: WORKSPACE_ID,
      setProjectRelocationSelected: vi.fn(),
      relocateProjects: h.relocate,
      undoRelocation: vi.fn(),
      clearProjectRelocation: h.clear,
    }),
}));
vi.mock('./LocateMovedProjectRow', () => ({
  LocateMovedProjectRow: () => <li>ledger-core</li>,
}));

import { LocateMovedProjects } from './index';

afterEach(cleanup);

describe('LocateMovedProjects', () => {
  it('ends with cancel, the alternative and the primary inline, and each still works', () => {
    const onChoose = vi.fn();
    render(<LocateMovedProjects workspaceId={WORKSPACE_ID} onChoose={onChoose} />);

    const move = screen.getByRole('button', { name: 'Move 1 project' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const choose = screen.getByRole('button', { name: 'Choose another folder' });
    expect(move.closest('[data-slot="form-actions"]')).not.toBeNull();
    expect(cancel.parentElement).toBe(move.parentElement);
    expect(move.parentElement?.lastElementChild).toBe(move);

    fireEvent.click(move);
    expect(h.relocate).toHaveBeenCalledOnce();
    fireEvent.click(choose);
    expect(onChoose).toHaveBeenCalledOnce();
    fireEvent.click(cancel);
    expect(h.clear).toHaveBeenCalledOnce();
  });
});
