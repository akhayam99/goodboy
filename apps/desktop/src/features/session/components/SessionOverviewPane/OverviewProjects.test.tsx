// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    sessionProjectMounts: {} as Record<string, ReadonlyArray<{ projectId: string }>>,
    projects: [] as ReadonlyArray<{ id: string; workspaceId: string }>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../ProjectSwitcher/AddProjectChip', () => ({
  AddProjectChip: () => <button type="button">+ project</button>,
}));

import { OverviewProjects } from './OverviewProjects';

const WS_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 'sess-1' as SessionId;

const session = { id: SESSION_ID, workspaceId: WS_ID } as Session;

beforeEach(() => {
  state.sessionProjectMounts = {};
  state.projects = [];
});
afterEach(cleanup);

describe('OverviewProjects', () => {
  it('offers the add-project affordance while unmaterialized projects exist', () => {
    state.projects = [{ id: 'p-1', workspaceId: WS_ID }];
    render(<OverviewProjects session={session} />);
    expect(screen.getByText('Projects')).toBeDefined();
    expect(screen.getByRole('button', { name: '+ project' })).toBeDefined();
  });

  it('disappears once every workspace project is mounted', () => {
    state.projects = [{ id: 'p-1', workspaceId: WS_ID }];
    state.sessionProjectMounts = { [SESSION_ID]: [{ projectId: 'p-1' }] };
    const { container } = render(<OverviewProjects session={session} />);
    expect(container.firstChild).toBeNull();
  });

  it('ignores projects from other workspaces', () => {
    state.projects = [{ id: 'p-2', workspaceId: 'ws-other' }];
    const { container } = render(<OverviewProjects session={session} />);
    expect(container.firstChild).toBeNull();
  });
});
